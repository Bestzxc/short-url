const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../lib/auth');

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return { email, password };
}

router.post('/register', async (req, res) => {
  const { email, password } = readCredentials(req.body);
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }
  if (password.length < 8 || password.length > 72) {
    // bcrypt only uses the first 72 bytes
    return res.status(400).json({ error: 'รหัสผ่านต้องยาว 8-72 ตัวอักษร' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash],
    );
    const user = { user_id: result.insertId, email };
    setAuthCookie(res, user);
    res.status(201).json({ user: { userId: user.user_id, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const [rows] = await pool.execute(
    'SELECT user_id, email, password_hash FROM users WHERE email = ?',
    [email],
  );
  const user = rows[0];
  // Same message for unknown email and wrong password, so emails can't be enumerated
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  setAuthCookie(res, user);
  res.json({ user: { userId: user.user_id, email: user.email } });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
