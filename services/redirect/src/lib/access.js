const bcrypt = require('bcrypt');
const pool = require('../db');

// Coarse device classification from the User-Agent header, used for click statistics
function detectDeviceType(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return 'mobile';
  return 'desktop';
}

// State of a link from the owner's point of view, in the order visitors are checked.
// Kept in sync with services/api/src/lib/links.js's copy of the same function — same order of
// checks (inactive > expired > limit-reached > active). Duplicated rather than shared so each
// service stays independently deployable; it's six lines and changes rarely.
function linkState(link, clickCount) {
  if (!link.is_active) return 'inactive';
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return 'expired';
  if (link.max_clicks != null && clickCount >= link.max_clicks) return 'limit-reached';
  return 'active';
}

// Handles one visit to a short code. The order of checks matters: a click is only counted
// (and the redirect only happens) after every check has passed, including the password.
//
//   1. link exists?  2. enabled?  3. expired?  4. click limit reached?  5. password?  6. count click
//
// Returns { outcome: 'redirect', url } | { outcome: 'status', status } | { outcome: 'not-found' }
//       | { outcome: 'password-required' } | { outcome: 'wrong-password' }
async function visitLink(code, { userAgent, password } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Lock the link row so two simultaneous visits can't both take the last allowed click
    const [rows] = await conn.execute(
      `SELECT link_id, original_url, link_password_hash, expires_at, max_clicks, is_active
         FROM links WHERE short_code = ? FOR UPDATE`,
      [code],
    );
    const link = rows[0];
    if (!link) {
      await conn.rollback();
      return { outcome: 'not-found' };
    }

    const [[{ total }]] = await conn.execute('SELECT COUNT(*) AS total FROM clicks WHERE link_id = ?', [link.link_id]);
    const state = linkState(link, Number(total));
    if (state !== 'active') {
      await conn.rollback();
      return { outcome: 'status', status: state };
    }

    if (link.link_password_hash) {
      if (typeof password !== 'string') {
        await conn.rollback();
        return { outcome: 'password-required' };
      }
      if (!(await bcrypt.compare(password, link.link_password_hash))) {
        await conn.rollback();
        return { outcome: 'wrong-password' };
      }
    }

    await conn.execute('INSERT INTO clicks (link_id, device_type) VALUES (?, ?)', [
      link.link_id,
      detectDeviceType(userAgent),
    ]);
    await conn.commit();
    return { outcome: 'redirect', url: link.original_url };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { linkState, visitLink };
