// Starts the api service and the redirect service together, against one shared throw-away
// database, and sets each service's env so they point at each other and at it.
//
// Start a test MySQL once with:
//   docker run -d --name ziplink-test-db -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 3308:3306 mysql:8.4 --character-set-server=utf8mb4
// or point TEST_DATABASE_URL at any empty MySQL you do not mind losing the tables of.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://root@127.0.0.1:3308/ziplink_integration_test';

async function resetDatabase() {
  const url = new URL(TEST_DATABASE_URL);
  const database = url.pathname.slice(1);
  const server = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    multipleStatements: true,
  });
  try {
    await server.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
    await server.query(`USE \`${database}\``);
    await server.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    await server.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ['clicks', 'links', 'users']) await server.query(`TRUNCATE TABLE ${table}`);
    await server.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await server.end();
  }
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server };
}

// Boots both services. The redirect service comes up first so its real port can be handed to the
// api service as REDIRECT_BASE_URL — exactly the env wiring the two get in docker-compose/production.
async function startServices() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DB_SSL = 'false';
  process.env.FRONTEND_URL = 'http://frontend.test';

  const redirect = await listen(require('../services/redirect/src/app'));

  process.env.REDIRECT_BASE_URL = redirect.baseUrl;
  process.env.JWT_SECRET = 'test-secret-not-for-production';
  process.env.COOKIE_SECURE = 'false';
  const api = await listen(require('../services/api/src/app'));

  return { api, redirect };
}

async function readBody(res, type) {
  if (type.includes('json')) return res.json();
  return res.text();
}

// A tiny HTTP client that remembers the login cookie, like a browser would. Talks to whichever
// base URL is passed per call, so the same client can hit both services (mirrors how the
// frontend's Next.js rewrites send /api/* to one origin and /:code to the other).
function createClient() {
  let cookie = '';
  async function request(base, method, url, { body, headers = {} } = {}) {
    const res = await fetch(base + url, {
      method,
      redirect: 'manual',
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.startsWith('token=;') ? '' : setCookie.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, headers: res.headers, body: await readBody(res, type) };
  }
  return {
    get: (base, url, options) => request(base, 'GET', url, options),
    post: (base, url, body, options) => request(base, 'POST', url, { body, ...options }),
    patch: (base, url, body) => request(base, 'PATCH', url, { body }),
  };
}

let counter = 0;
const uniqueEmail = () => `user${Date.now()}${counter++}@example.com`;

module.exports = { resetDatabase, startServices, createClient, uniqueEmail };
