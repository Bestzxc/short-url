const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { frontendUrl } = require('./config');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const redirectRoutes = require('./routes/redirect');

const app = express();

// Render/Railway terminate TLS at a proxy; needed for secure cookies and req.protocol
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

// Health check for the host, and a cheap way to wake a sleeping free instance
app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => res.redirect(302, frontendUrl));

app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));

// Must come last: /:code would otherwise swallow the routes above
app.use(redirectRoutes);

// Express 5 forwards rejected promises from async handlers here
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
});

module.exports = app;
