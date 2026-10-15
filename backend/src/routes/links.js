const express = require('express');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const pool = require('../db');
const { requireAuth } = require('../lib/auth');
const { generateShortCode, normalizeUrl, shortUrlFor, passwordTooLong, PASSWORD_TOO_LONG } = require('../lib/links');
const { linkState } = require('../lib/access');
const { parseTzOffset, dayRange, monthRange } = require('../lib/range');

const router = express.Router();
router.use(requireAuth);

const MAX_CODE_ATTEMPTS = 5;
const MAX_TITLE_LENGTH = 100;
const BCRYPT_ROUNDS = 10;

class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

// Owner's own label for a link; empty means "no title"
function parseTitle(value) {
  const title = typeof value === 'string' ? value.trim() : '';
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError('title', `ชื่อลิงก์ต้องไม่เกิน ${MAX_TITLE_LENGTH} ตัวอักษร`);
  }
  return title || null;
}

// Field parsers shared by "create" and "edit". Each throws ValidationError(field, message).

// Expiry must be in the future. When editing, keeping the link's current value is always allowed
// (an already-expired link can still be renamed without touching its expiry).
function parseExpiresAt(value, currentValue = null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError('expiresAt', 'วันหมดอายุไม่ถูกต้อง');
  // DATETIME keeps whole seconds only, so compare with a 1-second tolerance
  const unchanged = currentValue && Math.abs(new Date(currentValue).getTime() - date.getTime()) < 1000;
  if (date <= new Date() && !unchanged) throw new ValidationError('expiresAt', 'วันหมดอายุต้องเป็นเวลาในอนาคต');
  return date;
}

function parseMaxClicks(value) {
  const n = Number(value);
  if (value === '' || !Number.isInteger(n) || n < 1 || n > 1000000) {
    throw new ValidationError('maxClicks', 'จำนวนคลิกสูงสุดต้องเป็นจำนวนเต็ม 1 - 1,000,000');
  }
  return n;
}

function parseLinkPassword(value) {
  if (typeof value !== 'string' || value.length < 4) {
    throw new ValidationError('linkPassword', 'รหัสผ่านลิงก์ต้องยาวอย่างน้อย 4 ตัวอักษร');
  }
  if (passwordTooLong(value)) throw new ValidationError('linkPassword', PASSWORD_TOO_LONG);
  return value;
}

// Reads the optional settings of a new link from a request body; throws ValidationError
// carrying the form field name so the frontend can mark the right input
function parseLinkOptions(body) {
  const options = { title: parseTitle(body.title), expiresAt: null, maxClicks: null, password: null };
  if (body.expiresAt) options.expiresAt = parseExpiresAt(body.expiresAt);
  if (body.maxClicks !== undefined && body.maxClicks !== null && body.maxClicks !== '') {
    options.maxClicks = parseMaxClicks(body.maxClicks);
  }
  if (typeof body.linkPassword === 'string' && body.linkPassword !== '') {
    options.password = parseLinkPassword(body.linkPassword);
  }
  return options;
}

function toLinkDto(row) {
  return {
    linkId: row.link_id,
    title: row.title,
    originalUrl: row.original_url,
    shortCode: row.short_code,
    shortUrl: shortUrlFor(row.short_code),
    isActive: Boolean(row.is_active),
    expiresAt: row.expires_at,
    maxClicks: row.max_clicks,
    hasPassword: Boolean(row.link_password_hash),
    createdAt: row.created_at,
    // active | inactive | expired | limit-reached
    status: linkState(row, Number(row.click_count ?? 0)),
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

// Shorten a URL (criteria 3), with optional title / expiry / click limit / password
router.post('/', async (req, res) => {
  const originalUrl = normalizeUrl(req.body?.originalUrl);
  if (!originalUrl) {
    return res.status(400).json({ field: 'originalUrl', error: 'กรุณากรอก URL ที่ขึ้นต้นด้วย http:// หรือ https://' });
  }

  let options;
  try {
    options = parseLinkOptions(req.body);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ field: err.field, error: err.message });
    throw err;
  }
  const passwordHash = options.password ? await bcrypt.hash(options.password, BCRYPT_ROUNDS) : null;

  const insert = (shortCode) =>
    pool.execute(
      `INSERT INTO links (user_id, title, original_url, short_code, link_password_hash, expires_at, max_clicks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, options.title, originalUrl, shortCode, passwordHash, options.expiresAt, options.maxClicks],
    );

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const [result] = await insert(generateShortCode());
      return res.status(201).json({ link: toLinkDto(await findOwnedLink(result.insertId, req.user.userId)) });
    } catch (err) {
      // Random code collided with an existing one: try another
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  res.status(503).json({ error: 'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่' });
});

// Edit a link. Any of these may be sent; fields left out stay as they are:
//   isActive     true | false
//   title        string ("" removes the name)
//   expiresAt    ISO date | null (null = never expires)
//   maxClicks    integer | null (null = unlimited)
//   linkPassword string (set / change) | null (remove)
// The destination URL can NOT be changed: links and QR codes already shared would silently
// start pointing somewhere else. Always scoped to the owner.
router.patch('/:id', async (req, res) => {
  const linkId = parseLinkId(req, res);
  if (!linkId) return;
  const current = await findOwnedLink(linkId, req.user.userId);
  if (!current) return res.status(404).json({ error: 'ไม่พบลิงก์' });

  const body = req.body ?? {};
  const changes = [];
  const values = [];
  const set = (column, value) => {
    changes.push(`${column} = ?`);
    values.push(value);
  };

  try {
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
      set('is_active', body.isActive);
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
      set('title', parseTitle(body.title));
    }
    if (body.expiresAt !== undefined) {
      set('expires_at', body.expiresAt === null ? null : parseExpiresAt(body.expiresAt, current.expires_at));
    }
    if (body.maxClicks !== undefined) {
      set('max_clicks', body.maxClicks === null ? null : parseMaxClicks(body.maxClicks));
    }
    if (body.linkPassword !== undefined) {
      set(
        'link_password_hash',
        body.linkPassword === null ? null : await bcrypt.hash(parseLinkPassword(body.linkPassword), BCRYPT_ROUNDS),
      );
    }
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ field: err.field, error: err.message });
    throw err;
  }
  if (changes.length === 0) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });

  await pool.execute(`UPDATE links SET ${changes.join(', ')} WHERE link_id = ? AND user_id = ?`, [
    ...values,
    linkId,
    req.user.userId,
  ]);

  const [rows] = await pool.execute(
    `SELECT l.*, COUNT(c.click_id) AS click_count, MAX(c.clicked_at) AS last_clicked_at
       FROM links l LEFT JOIN clicks c ON c.link_id = l.link_id
      WHERE l.link_id = ? AND l.user_id = ? GROUP BY l.link_id`,
    [linkId, req.user.userId],
  );
  res.json({ link: toLinkDto(rows[0]) });
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

// Statistics of one link: totals, split by device, and clicks over time.
//   ?range=7|14|30|all   7/14/30 local days as daily bars, or "all" as monthly bars (last 24 months)
//   ?tz=<minutes>        the browser's getTimezoneOffset(), so days follow the viewer's own calendar
// The click-by-click history is NOT included here: it is loaded page by page from /:id/clicks.
const STATS_RANGES = ['7', '14', '30', 'all'];

router.get('/:id/stats', async (req, res) => {
  const linkId = parseLinkId(req, res);
  if (!linkId) return;
  const link = await findOwnedLink(linkId, req.user.userId);
  if (!link) return res.status(404).json({ error: 'ไม่พบลิงก์' });

  const range = String(req.query.range ?? '7');
  if (!STATS_RANGES.includes(range)) {
    return res.status(400).json({ error: `range ต้องเป็น ${STATS_RANGES.join(' / ')}` });
  }
  const tzOffset = parseTzOffset(req.query.tz);

  const monthly = range === 'all';
  const { since, keys } = monthly ? monthRange(link.created_at, tzOffset) : dayRange(Number(range), tzOffset);
  const bucket = monthly ? '%Y-%m' : '%Y-%m-%d';

  const [[byDevice], [perBucket], [[last]]] = await Promise.all([
    pool.execute('SELECT device_type, COUNT(*) AS clicks FROM clicks WHERE link_id = ? GROUP BY device_type', [linkId]),
    pool.execute(
      `SELECT DATE_FORMAT(clicked_at - INTERVAL ? MINUTE, '${bucket}') AS bucket, COUNT(*) AS clicks
         FROM clicks
        WHERE link_id = ? AND clicked_at >= ?
        GROUP BY bucket`,
      [tzOffset, linkId, since],
    ),
    pool.execute('SELECT MAX(clicked_at) AS lastClickedAt FROM clicks WHERE link_id = ?', [linkId]),
  ]);

  const devices = { desktop: 0, mobile: 0, tablet: 0 };
  for (const row of byDevice) devices[row.device_type] = Number(row.clicks);
  const totalClicks = Object.values(devices).reduce((sum, n) => sum + n, 0);

  // One bar for every day / month of the range (0 when nobody clicked), oldest first
  const counts = new Map(perBucket.map((row) => [row.bucket, Number(row.clicks)]));
  const buckets = keys.map((key) => ({ key, clicks: counts.get(key) ?? 0 }));

  res.json({
    link: toLinkDto({ ...link, click_count: totalClicks, last_clicked_at: last?.lastClickedAt ?? null }),
    devices,
    range,
    unit: monthly ? 'month' : 'day',
    buckets,
    rangeClicks: buckets.reduce((sum, bar) => sum + bar.clicks, 0),
  });
});

// Click history, newest first, one page at a time (?page=1&limit=10, limit at most 50), so a link
// with a huge number of clicks is never loaded in one go. Only `limit` rows are read per request.
const DEFAULT_CLICK_PAGE = 10;
const MAX_CLICK_PAGE = 50;

router.get('/:id/clicks', async (req, res) => {
  const linkId = parseLinkId(req, res);
  if (!linkId) return;
  const link = await findOwnedLink(linkId, req.user.userId);
  if (!link) return res.status(404).json({ error: 'ไม่พบลิงก์' });

  const requested = Number(req.query.limit ?? DEFAULT_CLICK_PAGE);
  const limit = Number.isInteger(requested) ? Math.min(MAX_CLICK_PAGE, Math.max(1, requested)) : DEFAULT_CLICK_PAGE;
  const requestedPage = Number(req.query.page ?? 1);
  if (!Number.isInteger(requestedPage) || requestedPage < 1) return res.status(400).json({ error: 'page ไม่ถูกต้อง' });

  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM clicks WHERE link_id = ?', [linkId]);
  const totalPages = Math.max(1, Math.ceil(Number(total) / limit));
  const page = Math.min(requestedPage, totalPages);

  const [rows] = await pool.execute(
    `SELECT click_id, clicked_at, device_type
       FROM clicks
      WHERE link_id = ?
      ORDER BY clicked_at DESC, click_id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    [linkId],
  );

  res.json({
    clicks: rows.map((row) => ({ clickId: row.click_id, clickedAt: row.clicked_at, deviceType: row.device_type })),
    page,
    limit,
    totalPages,
    total: Number(total),
  });
});

module.exports = router;
