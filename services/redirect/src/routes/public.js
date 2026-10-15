const express = require('express');
const { visitLink } = require('../lib/access');
const { createRateLimiter } = require('../lib/rateLimit');

const router = express.Router();
const CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;
// 10 password attempts per 15 minutes for each visitor + link
const isLimited = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

// Visitor submits the password of a protected link. On success the click is counted and the
// original URL is returned; the frontend then sends the browser there.
router.post('/links/:code/unlock', async (req, res) => {
  const { code } = req.params;
  res.set('Cache-Control', 'no-store');
  if (!CODE_RE.test(code)) return res.status(404).json({ status: 'not-found' });

  if (isLimited(`${req.ip}:${code}`)) {
    return res.status(429).json({ error: 'ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const result = await visitLink(code, { userAgent: req.get('user-agent'), password });
  switch (result.outcome) {
    case 'redirect':
      return res.json({ url: result.url });
    case 'wrong-password':
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    case 'status':
      return res.status(410).json({ status: result.status });
    case 'password-required':
    default:
      return res.status(404).json({ status: 'not-found' });
  }
});

module.exports = router;
