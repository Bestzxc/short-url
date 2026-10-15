const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../lib/auth');
const { shortUrlFor } = require('../lib/links');
const { parseTzOffset, dayRange } = require('../lib/range');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_RANGES = [7, 30];
const TOP_LINKS = 5;

// Overview of all the logged-in user's links for the last 7 or 30 days.
//   ?days=7|30   range, counted in the visitor's own calendar days, today included
//   ?tz=<min>    the browser's getTimezoneOffset(), so "a day" is the user's local day
router.get('/', async (req, res) => {
  const days = Number(req.query.days ?? 7);
  if (!ALLOWED_RANGES.includes(days)) {
    return res.status(400).json({ error: `days ต้องเป็น ${ALLOWED_RANGES.join(' หรือ ')}` });
  }
  const tzOffset = parseTzOffset(req.query.tz);
  const userId = req.user.userId;
  const { since, keys } = dayRange(days, tzOffset);

  const [[perDay], [topRows], [[{ totalLinks }]]] = await Promise.all([
    pool.execute(
      `SELECT DATE_FORMAT(c.clicked_at - INTERVAL ? MINUTE, '%Y-%m-%d') AS day, COUNT(*) AS clicks
         FROM clicks c JOIN links l ON l.link_id = c.link_id
        WHERE l.user_id = ? AND c.clicked_at >= ?
        GROUP BY day`,
      [tzOffset, userId, since],
    ),
    pool.execute(
      `SELECT l.link_id, l.title, l.short_code, l.original_url, COUNT(*) AS clicks
         FROM clicks c JOIN links l ON l.link_id = c.link_id
        WHERE l.user_id = ? AND c.clicked_at >= ?
        GROUP BY l.link_id
        ORDER BY clicks DESC, l.link_id DESC
        LIMIT ${TOP_LINKS}`,
      [userId, since],
    ),
    pool.execute('SELECT COUNT(*) AS totalLinks FROM links WHERE user_id = ?', [userId]),
  ]);

  // One entry for every day of the range (0 when nobody clicked), oldest first
  const counts = new Map(perDay.map((r) => [r.day, Number(r.clicks)]));
  const daily = keys.map((day) => ({ day, clicks: counts.get(day) ?? 0 }));
  const totalClicks = daily.reduce((sum, d) => sum + d.clicks, 0);

  const topLinks = topRows.map((r) => ({
    linkId: r.link_id,
    title: r.title,
    shortUrl: shortUrlFor(r.short_code),
    originalUrl: r.original_url,
    clicks: Number(r.clicks),
  }));

  res.json({
    days,
    totalClicks,
    totalLinks: Number(totalLinks),
    avgPerDay: Math.round((totalClicks / days) * 10) / 10,
    topLink: topLinks[0] ?? null,
    topLinks,
    daily,
  });
});

module.exports = router;
