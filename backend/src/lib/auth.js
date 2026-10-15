const jwt = require('jsonwebtoken');
const { jwtSecret, cookieSecure } = require('../config');

const COOKIE_NAME = 'token';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function signToken(user) {
  return jwt.sign({ sub: user.user_id, email: user.email }, jwtSecret, { expiresIn: TOKEN_TTL_SECONDS });
}

// The frontend proxies /api/* through its own domain, so the cookie is first-party and
// sameSite=lax is enough. Secure is required in production (HTTPS on Vercel/Render).
const cookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: 'lax',
  path: '/',
};

function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, signToken(user), { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

// Rejects the request with 401 unless a valid JWT cookie is present; sets req.user = { userId, email }
function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth };
