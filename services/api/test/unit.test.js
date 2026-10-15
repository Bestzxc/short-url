require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateShortCode, normalizeUrl, shortUrlFor, passwordTooLong, linkState } = require('../src/lib/links');
const { parseTzOffset, dayRange, monthRange } = require('../src/lib/range');

test('generateShortCode makes 7 URL-safe characters and does not repeat', () => {
  const codes = new Set();
  for (let i = 0; i < 200; i++) {
    const code = generateShortCode();
    assert.match(code, /^[A-Za-z0-9]{7}$/);
    codes.add(code);
  }
  assert.equal(codes.size, 200);
});

test('normalizeUrl accepts http(s) URLs and adds https:// when missing', () => {
  assert.equal(normalizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(normalizeUrl('  example.com/page '), 'https://example.com/page');
  assert.equal(normalizeUrl('http://localhost:3000/x'), 'http://localhost:3000/x');
});

test('normalizeUrl rejects anything that is not a normal web address', () => {
  for (const bad of [undefined, null, 42, '', '   ', 'javascript:alert(1)', 'ftp://example.com', 'nodots', 'http://', `https://example.com/${'a'.repeat(2100)}`]) {
    assert.equal(normalizeUrl(bad), null, `should reject ${String(bad).slice(0, 30)}`);
  }
});

test('shortUrlFor builds a link against the redirect service, not this API', () => {
  assert.equal(shortUrlFor('abc1234'), 'http://redirect.test/abc1234');
});

test('passwordTooLong counts bytes, not characters (Thai = 3 bytes each)', () => {
  assert.equal(passwordTooLong('a'.repeat(72)), false);
  assert.equal(passwordTooLong('a'.repeat(73)), true);
  assert.equal(passwordTooLong('ก'.repeat(24)), false);
  assert.equal(passwordTooLong('ก'.repeat(25)), true);
});

test('linkState checks in the order inactive > expired > limit-reached > active', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.equal(linkState({ is_active: 1, expires_at: null, max_clicks: null }, 0), 'active');
  assert.equal(linkState({ is_active: 0, expires_at: past, max_clicks: 1 }, 5), 'inactive');
  assert.equal(linkState({ is_active: 1, expires_at: past, max_clicks: 1 }, 5), 'expired');
  assert.equal(linkState({ is_active: 1, expires_at: future, max_clicks: 5 }, 5), 'limit-reached');
  assert.equal(linkState({ is_active: 1, expires_at: future, max_clicks: 5 }, 4), 'active');
});

test('parseTzOffset keeps sane whole-minute offsets and ignores the rest', () => {
  assert.equal(parseTzOffset('-420'), -420);
  assert.equal(parseTzOffset(0), 0);
  assert.equal(parseTzOffset('abc'), 0);
  assert.equal(parseTzOffset('1.5'), 0);
  assert.equal(parseTzOffset('99999'), 0);
  assert.equal(parseTzOffset(undefined), 0);
});

test('dayRange lists the last N local days, oldest first, ending today', () => {
  const { since, keys } = dayRange(7, -420);
  assert.equal(keys.length, 7);
  assert.deepEqual([...keys].sort(), keys);
  const todayInThailand = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.equal(keys.at(-1), todayInThailand);
  // the range starts at local midnight = 17:00 UTC of the previous day
  assert.equal(since.getUTCHours(), 17);
});

test('monthRange runs from the start month to now and is capped', () => {
  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const thisMonth = monthRange(now, 0);
  assert.deepEqual(thisMonth.keys, [currentKey]);

  const longAgo = monthRange(new Date('2015-01-15T00:00:00Z'), 0, 24);
  assert.equal(longAgo.keys.length, 24);
  assert.equal(longAgo.keys.at(-1), currentKey);
  assert.equal(longAgo.since.getUTCDate(), 1);

  const spans = monthRange(new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)), 0);
  assert.equal(spans.keys.length, 13);
});
