const express = require('express');
const QRCode = require('qrcode');
const pool = require('../db');
const { requireAuth } = require('../lib/auth');
const { generateShortCode, normalizeUrl, shortUrlFor } = require('../lib/links');

const router = express.Router();
router.use(requireAuth);

const MAX_CODE_ATTEMPTS = 5;

function toLinkDto(row) {
  return {
    linkId: row.link_id,
    originalUrl: row.original_url,
    shortCode: row.short_code,
    shortUrl: shortUrlFor(row.short_code),
    isActive: Boolean(row.is_active),
    expiresAt: row.expires_at,
    maxClicks: row.max_clicks,
    hasPassword: Boolean(row.link_password_hash),
    createdAt: row.created_at,
    clickCount: Number(row.click_count ?? 0),
    lastClickedAt: row.last_clicked_at ?? null,
  };
}

// Every query below filters by user_id, so users can only see or change their own links
async function findOwnedLink(linkId, userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM links WHERE link_id = ? AND user_id = ?',
    [linkId, userId],
  );
  return rows[0] || null;
}

function parseLinkId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'รหัสลิงก์ไม่ถูกต้อง' });
    return null;
  }
  return id;
}

// History list with click totals (criteria 5)
router.get('/', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT l.*, COUNT(c.click_id) AS click_count, MAX(c.clicked_at) AS last_clicked_at
       FROM links l
       LEFT JOIN clicks c ON c.link_id = l.link_id
      WHERE l.user_id = ?
      GROUP BY l.link_id
      ORDER BY l.created_at DESC, l.link_id DESC`,
    [req.user.userId],
  );
  res.json({ links: rows.map(toLinkDto) });
});

// Shorten a URL (criteria 3)
router.post('/', async (req, res) => {
  const originalUrl = normalizeUrl(req.body?.originalUrl);
  if (!originalUrl) {
    return res.status(400).json({ error: 'กรุณากรอก URL ที่ขึ้นต้นด้วย http:// หรือ https://' });
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const shortCode = generateShortCode();
    try {
      const [result] = await pool.execute(
        'INSERT INTO links (user_id, original_url, short_code) VALUES (?, ?, ?)',
        [req.user.userId, originalUrl, shortCode],
      );
      const link = await findOwnedLink(result.insertId, req.user.userId);
      return res.status(201).json({ link: toLinkDto(link) });
    } catch (err) {
      // Random code collided with an existing one: try another
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  res.status(503).json({ error: 'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่' });
});

router.delete('/:id', async (req, res) => {
  const linkId = parseLinkId(req, res);
  if (!linkId) return;
  // clicks are removed by ON DELETE CASCADE
  const [result] = await pool.execute(
    'DELETE FROM links WHERE link_id = ? AND user_id = ?',
    [linkId, req.user.userId],
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบลิงก์' });
  res.status(204).end();
});

// QR code of the short URL as PNG (criteria 4); ?download=1 makes the browser save it
router.get('/:id/qr', async (req, res) => {
  const linkId = parseLinkId(req, res);
  if (!linkId) return;
  const link = await findOwnedLink(linkId, req.user.userId);
  if (!link) return res.status(404).json({ error: 'ไม่พบลิงก์' });

  const png = await QRCode.toBuffer(shortUrlFor(link.short_code), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'private, max-age=86400');
  if (req.query.download) {
    res.set('Content-Disposition', `attachment; filename="qr-${link.short_code}.png"`);
  }
  res.send(png);
});

// Click statistics for one link: totals, per device, per day (last 14 days), recent clicks.
// ?tz=<minutes> is the browser's getTimezoneOffset(), so days follow the viewer's local date.
router.get('/:id/stats', async (req, res) => {
  const linkId = parseLinkId(req, res);
  if (!linkId) return;
  const link = await findOwnedLink(linkId, req.user.userId);
  if (!link) return res.status(404).json({ error: 'ไม่พบลิงก์' });

  const tz = Number(req.query.tz);
  const tzOffset = Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0;

  const [[byDevice], [byDay], [recent]] = await Promise.all([
    pool.execute(
      'SELECT device_type, COUNT(*) AS clicks FROM clicks WHERE link_id = ? GROUP BY device_type',
      [linkId],
    ),
    pool.execute(
      `SELECT DATE_FORMAT(clicked_at - INTERVAL ? MINUTE, '%Y-%m-%d') AS day, COUNT(*) AS clicks
         FROM clicks
        WHERE link_id = ? AND clicked_at >= UTC_TIMESTAMP() - INTERVAL 15 DAY
        GROUP BY day
        ORDER BY day`,
      [tzOffset, linkId],
    ),
    pool.execute(
      'SELECT clicked_at, device_type FROM clicks WHERE link_id = ? ORDER BY clicked_at DESC, click_id DESC LIMIT 20',
      [linkId],
    ),
  ]);

  const devices = { desktop: 0, mobile: 0, tablet: 0 };
  for (const row of byDevice) devices[row.device_type] = Number(row.clicks);

  res.json({
    link: toLinkDto({
      ...link,
      click_count: Object.values(devices).reduce((a, b) => a + b, 0),
      last_clicked_at: recent[0]?.clicked_at ?? null,
    }),
    devices,
    daily: byDay.map((row) => ({ day: row.day, clicks: Number(row.clicks) })),
    recent: recent.map((row) => ({ clickedAt: row.clicked_at, deviceType: row.device_type })),
  });
});

module.exports = router;
