const crypto = require('node:crypto');
const { publicBaseUrl } = require('../config');

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

function shortUrlFor(code) {
  return `${publicBaseUrl}/${code}`;
}

// Coarse device classification from the User-Agent header, used for click statistics
function detectDeviceType(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return 'mobile';
  return 'desktop';
}

// bcrypt only reads the first 72 BYTES of a password and silently ignores the rest. Thai
// letters take 3 bytes each (English 1), so the limit is checked in bytes, not characters.
const MAX_PASSWORD_BYTES = 72;
const PASSWORD_TOO_LONG = 'รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์: ภาษาอังกฤษ 72 ตัว หรือภาษาไทยประมาณ 24 ตัว)';

function passwordTooLong(password) {
  return Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES;
}

module.exports = { generateShortCode, normalizeUrl, shortUrlFor, detectDeviceType, passwordTooLong, PASSWORD_TOO_LONG };
