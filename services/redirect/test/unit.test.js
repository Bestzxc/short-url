require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { linkState } = require('../src/lib/access');
const { createRateLimiter } = require('../src/lib/rateLimit');

// detectDeviceType isn't exported (it's only used internally by visitLink), so it's exercised
// indirectly through the "remembers the device" test in api.test.js instead.

test('linkState checks in the order inactive > expired > limit-reached > active', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.equal(linkState({ is_active: 1, expires_at: null, max_clicks: null }, 0), 'active');
  assert.equal(linkState({ is_active: 0, expires_at: past, max_clicks: 1 }, 5), 'inactive');
  assert.equal(linkState({ is_active: 1, expires_at: past, max_clicks: 1 }, 5), 'expired');
  assert.equal(linkState({ is_active: 1, expires_at: future, max_clicks: 5 }, 5), 'limit-reached');
  assert.equal(linkState({ is_active: 1, expires_at: future, max_clicks: 5 }, 4), 'active');
});

test('rate limiter allows `max` attempts per window and then starts again', async () => {
  const isLimited = createRateLimiter({ max: 3, windowMs: 40 });
  assert.deepEqual([1, 2, 3, 4, 5].map(() => isLimited('a')), [false, false, false, true, true]);
  assert.equal(isLimited('b'), false, 'another key has its own counter');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(isLimited('a'), false, 'the window has passed');
});
