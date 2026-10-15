// The real contract between the two services, checked end to end: a link created on the api
// service must be visitable on the redirect service, and a click recorded there must show up
// back on the api service. Each service's OWN behaviour (validation, edge cases, pagination…) is
// already covered by its own test suite in services/*/test/ — this file stays small on purpose.
const { resetDatabase, startServices, createClient, uniqueEmail } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

const PASSWORD = 'password123';
let api;
let redirect;

test.before(async () => {
  await resetDatabase();
  ({ api, redirect } = await startServices());
});

test.after(async () => {
  await Promise.all([
    new Promise((resolve) => api.server.close(resolve)),
    new Promise((resolve) => redirect.server.close(resolve)),
  ]);
  await Promise.all([require('../services/api/src/db').end(), require('../services/redirect/src/db').end()]);
});

async function signedInClient() {
  const client = createClient();
  const res = await client.post(api.baseUrl, '/api/auth/register', { email: uniqueEmail(), password: PASSWORD });
  assert.equal(res.status, 201);
  return client;
}

test('both services report healthy and point at each other', async () => {
  const client = createClient();
  assert.equal((await client.get(api.baseUrl, '/health')).body.service, 'api');
  assert.equal((await client.get(redirect.baseUrl, '/health')).body.service, 'redirect');
});

test('a link created on the api service opens on the redirect service, and the click shows up back on the api', async () => {
  const owner = await signedInClient();
  const created = await owner.post(api.baseUrl, '/api/links', { originalUrl: 'https://example.com/cross-service', title: 'integration' });
  assert.equal(created.status, 201);
  const link = created.body.link;

  // The short URL the api service handed back must resolve on the redirect service's own origin
  assert.equal(link.shortUrl, `${redirect.baseUrl}/${link.shortCode}`);

  const visitor = createClient();
  const visit = await visitor.get(redirect.baseUrl, `/${link.shortCode}`);
  assert.equal(visit.status, 302);
  assert.equal(visit.headers.get('location'), 'https://example.com/cross-service');

  // ...and the api service, asked afterwards, must see that click
  const list = await owner.get(api.baseUrl, '/api/links');
  const seen = list.body.links.find((l) => l.linkId === link.linkId);
  assert.equal(seen.clickCount, 1);
  assert.ok(seen.lastClickedAt);

  const stats = await owner.get(api.baseUrl, `/api/links/${link.linkId}/stats`);
  assert.equal(stats.body.link.clickCount, 1);

  const clicks = await owner.get(api.baseUrl, `/api/links/${link.linkId}/clicks`);
  assert.equal(clicks.body.total, 1);
});

test('a password set through the api is the password the redirect service checks', async () => {
  const owner = await signedInClient();
  const created = await owner.post(api.baseUrl, '/api/links', { originalUrl: 'https://example.com/locked', linkPassword: 'secret1' });
  const link = created.body.link;

  const visitor = createClient();
  const gated = await visitor.get(redirect.baseUrl, `/${link.shortCode}`);
  assert.equal(gated.headers.get('location'), `http://frontend.test/unlock/${link.shortCode}`);

  const wrong = await visitor.post(redirect.baseUrl, `/api/public/links/${link.shortCode}/unlock`, { password: 'nope' });
  assert.equal(wrong.status, 401);

  const right = await visitor.post(redirect.baseUrl, `/api/public/links/${link.shortCode}/unlock`, { password: 'secret1' });
  assert.equal(right.status, 200);
  assert.equal(right.body.url, 'https://example.com/locked');

  // Changing the password on the api service must take effect on the next redirect-service visit
  await owner.patch(api.baseUrl, `/api/links/${link.linkId}`, { linkPassword: 'secret2' });
  assert.equal((await visitor.post(redirect.baseUrl, `/api/public/links/${link.shortCode}/unlock`, { password: 'secret1' })).status, 401, 'old password no longer works');
  assert.equal((await visitor.post(redirect.baseUrl, `/api/public/links/${link.shortCode}/unlock`, { password: 'secret2' })).status, 200);
});

test('turning a link off on the api service is immediately enforced by the redirect service', async () => {
  const owner = await signedInClient();
  const created = await owner.post(api.baseUrl, '/api/links', { originalUrl: 'https://example.com/toggle' });
  const link = created.body.link;
  const visitor = createClient();

  assert.equal((await visitor.get(redirect.baseUrl, `/${link.shortCode}`)).headers.get('location'), 'https://example.com/toggle');

  await owner.patch(api.baseUrl, `/api/links/${link.linkId}`, { isActive: false });
  assert.equal((await visitor.get(redirect.baseUrl, `/${link.shortCode}`)).headers.get('location'), 'http://frontend.test/status/inactive');
});
