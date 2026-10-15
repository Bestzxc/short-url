const express = require('express');
const { frontendUrl } = require('../config');
const { visitLink } = require('../lib/access');

const router = express.Router();
const CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;

function redirectToFrontend(res, path) {
  res.redirect(302, `${frontendUrl}${path}`);
}

// Public endpoint behind every short URL (process 4.0 in the DFD).
// No login needed: run the access checks, count the click, then redirect.
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  // Never let browsers/CDNs cache the redirect, otherwise repeat visits wouldn't be counted
  res.set('Cache-Control', 'no-store');
  if (!CODE_RE.test(code)) return redirectToFrontend(res, '/status/not-found');
  const result = await visitLink(code, { userAgent: req.get('user-agent') });
  switch (result.outcome) {
    case 'redirect':
      return res.redirect(302, result.url);
    case 'password-required':
      // The password form lives on the frontend; it submits to POST /api/public/links/:code/unlock
      return redirectToFrontend(res, `/unlock/${encodeURIComponent(code)}`);
    case 'status':
      return redirectToFrontend(res, `/status/${result.status}`);
    default:
      return redirectToFrontend(res, '/status/not-found');
  }
});

module.exports = router;
