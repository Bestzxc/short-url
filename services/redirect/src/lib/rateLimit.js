// Tiny in-memory limiter for password guesses: at most `max` attempts per `windowMs` per key.
// Good enough for a single instance; a shared store (Redis) would be needed to scale out.
function createRateLimiter({ max, windowMs }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return function isLimited(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}

module.exports = { createRateLimiter };
