const express = require('express');
const pool = require('../db');
const { frontendUrl } = require('../config');
const { detectDeviceType } = require('../lib/links');

const router = express.Router();
const CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;

function redirectToStatus(res, status) {
  res.redirect(302, `${frontendUrl}/status/${status}`);
}

// Public endpoint behind every short URL (process 4.0 in the DFD).
// No login needed: look up the code, record the click, then redirect.
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  // Never let browsers/CDNs cache the redirect, otherwise repeat visits wouldn't be counted
  res.set('Cache-Control', 'no-store');

  if (!CODE_RE.test(code)) return redirectToStatus(res, 'not-found');

  const [rows] = await pool.execute(
    'SELECT link_id, original_url FROM links WHERE short_code = ?',
    [code],
  );
  const link = rows[0];
  if (!link) return redirectToStatus(res, 'not-found');

  await pool.execute(
    'INSERT INTO clicks (link_id, device_type) VALUES (?, ?)',
    [link.link_id, detectDeviceType(req.get('user-agent'))],
  );
  res.redirect(302, link.original_url);
});

module.exports = router;
