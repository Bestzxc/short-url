const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { frontendUrl } = require('./config');
const publicRoutes = require('./routes/public');
const redirectRoutes = require('./routes/redirect');

const app = express();

// Render terminates TLS at a proxy; needed for req.protocol and the real client IP (rate limiting)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Short-link visits and the unlock form are both unauthenticated — no cookies are read or set
// here, so there is nothing a cookie-parser would do.
app.use(cors({ origin: frontendUrl }));
app.use(express.json({ limit: '4kb' })); // only the unlock form's { password } body

// Health check for the host, and a cheap way to wake a sleeping free instance
app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', service: 'redirect' });
});

app.use('/api/public', publicRoutes);

// Must come last: /:code would otherwise swallow the route above
app.use(redirectRoutes);

// Express 5 forwards rejected promises from async handlers here
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
});

module.exports = app;
