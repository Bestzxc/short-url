const crypto = require('node:crypto');
const { redirectBaseUrl } = require('../config');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 7; // 62^7 ≈ 3.5 trillion combinations

function generateShortCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  // 256 % 62 introduces a tiny bias; acceptable for non-secret identifiers
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return code;
}

// Accepts only absolute http(s) URLs; returns the normalized URL or null
function normalizeUrl(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim();
  if (!value || value.length > 2048) return null;
  // Let users paste "example.com/page" without the scheme
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}

// The short link lives on the redirect service, not on this API, so links are built against that
// service's public origin (REDIRECT_BASE_URL).
function shortUrlFor(code) {
  return `${redirectBaseUrl}/${code}`;
}

// bcrypt only reads the first 72 BYTES of a password and silently ignores the rest. Thai
// letters take 3 bytes each (English 1), so the limit is checked in bytes, not characters.
const MAX_PASSWORD_BYTES = 72;
const PASSWORD_TOO_LONG = 'รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์: ภาษาอังกฤษ 72 ตัว หรือภาษาไทยประมาณ 24 ตัว)';

function passwordTooLong(password) {
  return Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES;
}

// State of a link from the owner's point of view, in the order visitors are checked.
// Kept in sync with services/redirect/src/lib/access.js's copy of the same function — same
// order of checks (inactive > expired > limit-reached > active). Duplicated rather than shared
// so each service stays independently deployable; it's six lines and changes rarely.
function linkState(link, clickCount) {
  if (!link.is_active) return 'inactive';
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return 'expired';
  if (link.max_clicks != null && clickCount >= link.max_clicks) return 'limit-reached';
  return 'active';
}

module.exports = { generateShortCode, normalizeUrl, shortUrlFor, passwordTooLong, PASSWORD_TOO_LONG, linkState };
