// Tests this service in isolation: links are seeded straight into the database (createTestLink
// in helpers.js) instead of going through the API service. The cross-service flow (create a link
// on the API, open it here, see the click back on the API) is covered separately in
// test/integration.test.js at the repository root, which starts both services together.
const { resetDatabase, startServer, createClient, createTestLink } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

let baseUrl;
let server;
let pool;

test.before(async () => {
  await resetDatabase();
  ({ baseUrl, server } = await startServer());
  pool = require('../src/db');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function clickCount(linkId) {
  const [[{ n }]] = await pool.execute('SELECT COUNT(*) AS n FROM clicks WHERE link_id = ?', [linkId]);
  return Number(n);
}

async function deviceCounts(linkId) {
  const [rows] = await pool.execute('SELECT device_type, COUNT(*) AS n FROM clicks WHERE link_id = ? GROUP BY device_type', [linkId]);
  return Object.fromEntries(rows.map((r) => [r.device_type, Number(r.n)]));
}

test('health check reports this service', async () => {
  const client = createClient(baseUrl);
  const health = await client.get('/health');
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.service, 'redirect');
});

test('visiting a short URL redirects, counts the click and remembers the device', async () => {
  const client = createClient(baseUrl);
  const link = await createTestLink(pool, { originalUrl: 'https://example.com/target' });

  const desktop = await client.get(`/${link.shortCode}`);
  assert.equal(desktop.status, 302);
  assert.equal(desktop.headers.get('location'), 'https://example.com/target');
  assert.equal(desktop.headers.get('cache-control'), 'no-store');

  await client.get(`/${link.shortCode}`, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile Safari' } });
  await client.get(`/${link.shortCode}`, { headers: { 'user-agent': 'Mozilla/5.0 (iPad; CPU OS 17_0)' } });

  assert.equal(await clickCount(link.linkId), 3);
  assert.deepEqual(await deviceCounts(link.linkId), { desktop: 1, mobile: 1, tablet: 1 });
});

test('short codes are case-sensitive and bad ones go to the not-found page', async () => {
  const client = createClient(baseUrl);
  const link = await createTestLink(pool);
  const swapped = link.shortCode.replace(/[a-zA-Z]/, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));

  for (const code of ['does-not-exist', swapped, 'bad$code', 'x'.repeat(51)]) {
    const res = await client.get(`/${code}`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'http://frontend.test/status/not-found');
  }
});

test('visitors are sent to a status page for switched-off, expired and used-up links', async () => {
  const client = createClient(baseUrl);
  const whereTo = async (code) => (await client.get(`/${code}`)).headers.get('location');

  const off = await createTestLink(pool, { isActive: false });
  assert.equal(await whereTo(off.shortCode), 'http://frontend.test/status/inactive');

  const expired = await createTestLink(pool, { expiresAt: new Date(Date.now() - 60_000) });
  assert.equal(await whereTo(expired.shortCode), 'http://frontend.test/status/expired');

  const limited = await createTestLink(pool, { maxClicks: 2, originalUrl: 'https://example.com/limited' });
  assert.equal(await whereTo(limited.shortCode), 'https://example.com/limited');
  assert.equal(await whereTo(limited.shortCode), 'https://example.com/limited');
  assert.equal(await whereTo(limited.shortCode), 'http://frontend.test/status/limit-reached');
  assert.equal(await clickCount(limited.linkId), 2, 'a refused visit is not counted');
});

test('two visits at the same moment cannot both take the last allowed click', async () => {
  const client = createClient(baseUrl);
  const link = await createTestLink(pool, { maxClicks: 1, originalUrl: 'https://example.com/one-click' });

  const results = await Promise.all(Array.from({ length: 6 }, () => createClient(baseUrl).get(`/${link.shortCode}`)));
  const redirected = results.filter((r) => r.headers.get('location') === 'https://example.com/one-click');
  assert.equal(redirected.length, 1);
  assert.equal(await clickCount(link.linkId), 1);
});

test('password-protected links: ask for the password, then count the click', async () => {
  const client = createClient(baseUrl);
  const link = await createTestLink(pool, { password: 'secret1', originalUrl: 'https://example.com/private' });
  const unlock = (password) => client.post(`/api/public/links/${link.shortCode}/unlock`, password === undefined ? {} : { password });

  const direct = await client.get(`/${link.shortCode}`);
  assert.equal(direct.headers.get('location'), `http://frontend.test/unlock/${link.shortCode}`);
  assert.equal(await clickCount(link.linkId), 0, 'no click before the password');

  assert.equal((await unlock('wrong')).status, 401);
  assert.equal((await unlock()).status, 401);
  assert.equal(await clickCount(link.linkId), 0);

  const ok = await unlock('secret1');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.url, 'https://example.com/private');
  assert.equal(await clickCount(link.linkId), 1);
});

test('the unlock endpoint reports missing, unusable and unprotected links', async () => {
  const client = createClient(baseUrl);

  assert.equal((await client.post('/api/public/links/nothing-here/unlock', { password: 'x' })).status, 404);
  assert.equal((await client.post('/api/public/links/bad$code/unlock', { password: 'x' })).status, 404);

  const off = await createTestLink(pool, { password: 'secret1', isActive: false });
  const res = await client.post(`/api/public/links/${off.shortCode}/unlock`, { password: 'secret1' });
  assert.equal(res.status, 410);
  assert.equal(res.body.status, 'inactive');

  const open = await createTestLink(pool);
  const unprotected = await client.post(`/api/public/links/${open.shortCode}/unlock`, { password: 'anything' });
  assert.equal(unprotected.status, 200, 'a link without a password just opens');
});

test('too many wrong passwords are blocked for a while', async () => {
  const client = createClient(baseUrl);
  const link = await createTestLink(pool, { password: 'secret1' });
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    statuses.push((await client.post(`/api/public/links/${link.shortCode}/unlock`, { password: 'nope' })).status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.deepEqual(statuses.slice(10), [429, 429]);
  assert.equal((await client.post(`/api/public/links/${link.shortCode}/unlock`, { password: 'secret1' })).status, 429, 'even the right one');
});
