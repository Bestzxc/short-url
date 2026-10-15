const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../lib/auth');
const { passwordTooLong, PASSWORD_TOO_LONG } = require('../lib/links');

const router = express.Router();
const BCRYPT_ROUNDS = 10;

// name@domain.tld, checked step by step (a single regex for this can backtrack for a long time)
function isValidEmail(value) {
  if (/\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[0]) return false;
  const dot = parts[1].lastIndexOf('.');
  return dot > 0 && dot < parts[1].length - 1;
}

function readCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return { email, password };
}

router.post('/register', async (req, res) => {
  const { email, password } = readCredentials(req.body);
  if (!isValidEmail(email) || email.length > 255) {
    return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' });
  }
  if (passwordTooLong(password)) {
    return res.status(400).json({ error: PASSWORD_TOO_LONG });
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
