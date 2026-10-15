// Tests this service in isolation: no HTTP calls to the redirect service. A "click" is simulated
// by inserting straight into the `clicks` table — exactly what the redirect service does when it
// handles a real visit — so these tests don't depend on that service being up.
// The cross-service flow (create here, visit there, see the click here) is covered separately in
// test/integration.test.js at the repository root, which starts both services together.
const { resetDatabase, startServer, createClient, uniqueEmail } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

const PASSWORD = 'password123';
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

// A client that is already registered and logged in
async function signedInClient() {
  const client = createClient(baseUrl);
  const res = await client.post('/api/auth/register', { email: uniqueEmail(), password: PASSWORD });
  assert.equal(res.status, 201);
  return client;
}

async function createLink(client, body = {}) {
  const res = await client.post('/api/links', { originalUrl: 'https://example.com/page', ...body });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.link;
}

// Inserts `count` clicks directly into the database, newest first, with a few sharing the same
// second — standing in for visits the redirect service would otherwise have recorded.
async function addClicks(linkId, count, { hoursBetween = 1 } = {}) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const at = new Date(Date.now() - Math.floor(i / 3) * hoursBetween * 3600_000);
    rows.push([linkId, at, ['desktop', 'mobile', 'tablet'][i % 3]]);
  }
  await pool.query('INSERT INTO clicks (link_id, clicked_at, device_type) VALUES ?', [rows]);
}

test('server basics: health, root redirect, unknown API, broken JSON', async () => {
  const client = createClient(baseUrl);
  const health = await client.get('/health');
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.service, 'api');

  const root = await client.get('/');
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), 'http://frontend.test');

  assert.equal((await client.get('/api/nope')).status, 404);

  const broken = await client.post('/api/auth/login', '{not json', { raw: true, headers: { 'content-type': 'application/json' } });
  assert.equal(broken.status, 400);
});

test('register: validates input, rejects duplicates, logs the user in', async () => {
  const client = createClient(baseUrl);
  const email = uniqueEmail();

  assert.equal((await client.post('/api/auth/register', { email: 'not-an-email', password: PASSWORD })).status, 400);
  assert.equal((await client.post('/api/auth/register', { email, password: 'short' })).status, 400);
  assert.equal((await client.post('/api/auth/register', { email, password: 'ก'.repeat(30) })).status, 400, 'over 72 bytes');
  assert.equal((await client.post('/api/auth/register', {})).status, 400);

  const created = await client.post('/api/auth/register', { email: email.toUpperCase(), password: PASSWORD });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.email, email, 'emails are stored in lower case');

  assert.equal((await client.get('/api/auth/me')).body.user.email, email, 'the cookie logs the user in');
  assert.equal((await client.post('/api/auth/register', { email, password: PASSWORD })).status, 409);
});

test('login, me and logout', async () => {
  const email = uniqueEmail();
  const client = createClient(baseUrl);
  await client.post('/api/auth/register', { email, password: PASSWORD });
  await client.post('/api/auth/logout');
  assert.equal((await client.get('/api/auth/me')).status, 401);

  assert.equal((await client.post('/api/auth/login', { email, password: 'wrong-password' })).status, 401);
  assert.equal((await client.post('/api/auth/login', { email: 'nobody@example.com', password: PASSWORD })).status, 401);

  const ok = await client.post('/api/auth/login', { email, password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.equal((await client.get('/api/auth/me')).body.user.email, email);

  const tampered = await createClient(baseUrl).get('/api/auth/me', { headers: { cookie: 'token=garbage' } });
  assert.equal(tampered.status, 401);
});

test('links need a login', async () => {
  const client = createClient(baseUrl);
  assert.equal((await client.get('/api/links')).status, 401);
  assert.equal((await client.post('/api/links', { originalUrl: 'https://example.com' })).status, 401);
});

test('create a link: normalises the URL and returns a short URL on the redirect service', async () => {
  const client = await signedInClient();
  const link = await createLink(client, { originalUrl: ' example.com/a ', title: '  โปรโมชั่น  ' });
  assert.equal(link.originalUrl, 'https://example.com/a');
  assert.equal(link.title, 'โปรโมชั่น');
  assert.match(link.shortCode, /^[A-Za-z0-9]{7}$/);
  assert.equal(link.shortUrl, `http://redirect.test/${link.shortCode}`);
  assert.equal(link.status, 'active');
  assert.equal(link.clickCount, 0);
  assert.equal(link.hasPassword, false);

  const bad = await client.post('/api/links', { originalUrl: 'javascript:alert(1)' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.field, 'originalUrl');
});

test('create a link with every option, and reject invalid options with the field name', async () => {
  const client = await signedInClient();
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  const link = await createLink(client, { expiresAt, maxClicks: 5, linkPassword: 'secret1' });
  assert.equal(link.maxClicks, 5);
  assert.equal(link.hasPassword, true);
  assert.ok(link.expiresAt);
  assert.ok(!('linkPasswordHash' in link) && !('link_password_hash' in link), 'the hash never leaves the server');

  const cases = [
    [{ title: 'x'.repeat(101) }, 'title'],
    [{ expiresAt: 'tomorrow-ish' }, 'expiresAt'],
    [{ expiresAt: '2000-01-01T00:00:00Z' }, 'expiresAt'],
    [{ maxClicks: 0 }, 'maxClicks'],
    [{ maxClicks: 1.5 }, 'maxClicks'],
    [{ maxClicks: 2000000 }, 'maxClicks'],
    [{ linkPassword: 'abc' }, 'linkPassword'],
    [{ linkPassword: 'ก'.repeat(25) }, 'linkPassword'],
  ];
  for (const [extra, field] of cases) {
    const res = await client.post('/api/links', { originalUrl: 'https://example.com', ...extra });
    assert.equal(res.status, 400, JSON.stringify(extra));
    assert.equal(res.body.field, field);
  }
});

test('list links: newest first with click counts, only my own', async () => {
  const mine = await signedInClient();
  const other = await signedInClient();
  const first = await createLink(mine, { title: 'first' });
  const second = await createLink(mine, { title: 'second' });
  await createLink(other, { title: 'not mine' });

  await addClicks(first.linkId, 1);

  const { body } = await mine.get('/api/links');
  assert.deepEqual(body.links.map((l) => l.title), ['second', 'first']);
  assert.equal(body.links.find((l) => l.linkId === first.linkId).clickCount, 1);
  assert.ok(body.links.find((l) => l.linkId === first.linkId).lastClickedAt);
  assert.equal(body.links.find((l) => l.linkId === second.linkId).clickCount, 0);
});

test('edit a link: any mix of settings, clearing, and validation', async () => {
  const client = await signedInClient();
  const link = await createLink(client);
  const url = `/api/links/${link.linkId}`;

  let res = await client.patch(url, { title: '  New  ', maxClicks: 5, isActive: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.link.title, 'New');
  assert.equal(res.body.link.maxClicks, 5);
  assert.equal(res.body.link.status, 'inactive');

  res = await client.patch(url, { linkPassword: 'secret1', isActive: true });
  assert.equal(res.body.link.hasPassword, true);
  assert.equal(res.body.link.status, 'active');

  const future = new Date(Date.now() + 3600_000).toISOString();
  res = await client.patch(url, { expiresAt: future });
  assert.ok(res.body.link.expiresAt);

  res = await client.patch(url, { title: '', maxClicks: null, linkPassword: null, expiresAt: null });
  assert.equal(res.body.link.title, null);
  assert.equal(res.body.link.maxClicks, null);
  assert.equal(res.body.link.hasPassword, false);
  assert.equal(res.body.link.expiresAt, null);

  for (const bad of [{ isActive: 'yes' }, { title: 5 }, {}, { maxClicks: 0 }, { expiresAt: '2000-01-01T00:00:00Z' }, { linkPassword: 'abc' }]) {
    assert.equal((await client.patch(url, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await client.patch(url, { maxClicks: 0 })).body.field, 'maxClicks');

  assert.equal((await client.patch('/api/links/abc', { title: 'x' })).status, 400);
  assert.equal((await client.patch('/api/links/999999', { title: 'x' })).status, 404);
});

test('an already expired link can still be renamed without touching its expiry', async () => {
  const client = await signedInClient();
  const link = await createLink(client);
  await pool.execute('UPDATE links SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 HOUR WHERE link_id = ?', [link.linkId]);

  const current = (await client.get('/api/links')).body.links[0];
  assert.equal(current.status, 'expired');
  const res = await client.patch(`/api/links/${link.linkId}`, { title: 'still editable', expiresAt: current.expiresAt });
  assert.equal(res.status, 200);
  assert.equal(res.body.link.status, 'expired');
});

test('a link reaches "limit-reached" once its recorded clicks meet maxClicks', async () => {
  const client = await signedInClient();
  const link = await createLink(client, { maxClicks: 2 });
  await addClicks(link.linkId, 2);
  const { body } = await client.get('/api/links');
  const seen = body.links.find((l) => l.linkId === link.linkId);
  assert.equal(seen.clickCount, 2);
  assert.equal(seen.status, 'limit-reached');
});

test('nobody can read or change someone else\'s link', async () => {
  const owner = await signedInClient();
  const stranger = await signedInClient();
  const link = await createLink(owner);
  const base = `/api/links/${link.linkId}`;

  assert.equal((await stranger.patch(base, { title: 'hacked' })).status, 404);
  assert.equal((await stranger.delete(base)).status, 404);
  assert.equal((await stranger.get(`${base}/qr`)).status, 404);
  assert.equal((await stranger.get(`${base}/stats`)).status, 404);
  assert.equal((await stranger.get(`${base}/clicks`)).status, 404);
  assert.equal((await owner.get('/api/links')).body.links.length, 1, 'still there');
});

test('delete a link removes its clicks too', async () => {
  const client = await signedInClient();
  const link = await createLink(client);
  await addClicks(link.linkId, 3);

  assert.equal((await client.delete(`/api/links/${link.linkId}`)).status, 204);
  assert.equal((await client.delete(`/api/links/${link.linkId}`)).status, 404);
  assert.equal((await client.delete('/api/links/abc')).status, 400);
  const [[{ n }]] = await pool.execute('SELECT COUNT(*) AS n FROM clicks WHERE link_id = ?', [link.linkId]);
  assert.equal(Number(n), 0);
});

test('QR code is a PNG, and ?download=1 makes it a download', async () => {
  const client = await signedInClient();
  const link = await createLink(client);

  const inline = await client.get(`/api/links/${link.linkId}/qr`);
  assert.equal(inline.status, 200);
  assert.equal(inline.headers.get('content-type'), 'image/png');
  assert.equal(inline.body.subarray(1, 4).toString(), 'PNG');

  const download = await client.get(`/api/links/${link.linkId}/qr?download=1`);
  assert.match(download.headers.get('content-disposition') ?? '', /attachment/);
});

test('click history is paged: 10 per page by default, no repeats, newest first', async () => {
  const client = await signedInClient();
  const link = await createLink(client);
  await addClicks(link.linkId, 23);
  const seen = [];

  const page1 = await client.get(`/api/links/${link.linkId}/clicks`);
  assert.equal(page1.body.clicks.length, 10);
  assert.equal(page1.body.total, 23);
  assert.equal(page1.body.totalPages, 3);
  assert.equal(page1.body.page, 1);
  seen.push(...page1.body.clicks);

  seen.push(...(await client.get(`/api/links/${link.linkId}/clicks?page=2`)).body.clicks);
  const page3 = await client.get(`/api/links/${link.linkId}/clicks?page=3`);
  assert.equal(page3.body.clicks.length, 3);
  seen.push(...page3.body.clicks);

  assert.equal(new Set(seen.map((c) => c.clickId)).size, 23);
  const sorted = [...seen].sort((a, b) => new Date(b.clickedAt) - new Date(a.clickedAt) || b.clickId - a.clickId);
  assert.deepEqual(seen, sorted);

  const beyond = await client.get(`/api/links/${link.linkId}/clicks?page=99`);
  assert.equal(beyond.body.page, 3, 'a page past the end shows the last page');
});

test('click history limit is capped at 50 and bad paging is rejected', async () => {
  const client = await signedInClient();
  const link = await createLink(client);
  await addClicks(link.linkId, 60);
  const url = `/api/links/${link.linkId}/clicks`;

  assert.equal((await client.get(`${url}?limit=999`)).body.clicks.length, 50);
  assert.equal((await client.get(`${url}?limit=0`)).body.clicks.length, 1);
  assert.equal((await client.get(`${url}?limit=abc`)).body.clicks.length, 10);
  assert.equal((await client.get(`${url}?page=0`)).status, 400);
  assert.equal((await client.get(`${url}?page=x`)).status, 400);

  const empty = await createLink(client);
  const none = await client.get(`/api/links/${empty.linkId}/clicks`);
  assert.deepEqual([none.body.clicks.length, none.body.total, none.body.totalPages], [0, 0, 1]);
});

test('per-link stats: one bar per day or month, plus totals', async () => {
  const client = await signedInClient();
  const link = await createLink(client);
  await addClicks(link.linkId, 12, { hoursBetween: 5 });
  const url = `/api/links/${link.linkId}/stats`;

  for (const range of ['7', '14', '30']) {
    const { body } = await client.get(`${url}?range=${range}&tz=-420`);
    assert.equal(body.unit, 'day');
    assert.equal(body.buckets.length, Number(range));
    assert.equal(body.link.clickCount, 12);
    assert.equal(body.rangeClicks, 12);
  }
  const all = (await client.get(`${url}?range=all&tz=-420`)).body;
  assert.equal(all.unit, 'month');
  assert.ok(all.buckets.length >= 1);
  assert.equal(all.rangeClicks, 12);

  const byDefault = (await client.get(url)).body;
  assert.equal(byDefault.range, '7');
  assert.equal(byDefault.devices.desktop + byDefault.devices.mobile + byDefault.devices.tablet, 12);
  assert.ok(byDefault.link.lastClickedAt);

  assert.equal((await client.get(`${url}?range=99`)).status, 400);
  assert.equal((await client.get('/api/links/abc/stats')).status, 400);
});

test('overview stats: totals, average, top links and a bar per day', async () => {
  const client = await signedInClient();
  const busy = await createLink(client, { title: 'busy' });
  const quiet = await createLink(client, { title: 'quiet' });
  await addClicks(busy.linkId, 9, { hoursBetween: 1 });
  await addClicks(quiet.linkId, 2, { hoursBetween: 1 });

  const week = (await client.get('/api/stats?days=7&tz=-420')).body;
  assert.equal(week.days, 7);
  assert.equal(week.daily.length, 7);
  assert.equal(week.totalClicks, 11);
  assert.equal(week.totalLinks, 2);
  assert.equal(week.avgPerDay, 1.6);
  assert.equal(week.topLink.clicks, 9);
  assert.deepEqual(week.topLinks.map((l) => l.title), ['busy', 'quiet']);
  assert.equal(week.topLinks[0].shortUrl, busy.shortUrl);

  assert.equal((await client.get('/api/stats?days=30')).body.daily.length, 30);
  assert.equal((await client.get('/api/stats?days=5')).status, 400);
  assert.equal((await createClient(baseUrl).get('/api/stats')).status, 401);

  const fresh = await signedInClient();
  const nothing = (await fresh.get('/api/stats')).body;
  assert.equal(nothing.topLink, null);
  assert.equal(nothing.totalClicks, 0);
});
