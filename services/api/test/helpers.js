// Shared setup for the tests. Loaded FIRST in every test file: it points the app at a throw-away
// test database (never a real one) before any app code reads its configuration.
//
// Start a test MySQL once with:
//   docker run -d --name ziplink-test-db -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 3308:3306 mysql:8.4 --character-set-server=utf8mb4
// or point TEST_DATABASE_URL at any empty MySQL you do not mind losing the tables of.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://root@127.0.0.1:3308/ziplink_test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.FRONTEND_URL = 'http://frontend.test';
process.env.REDIRECT_BASE_URL = 'http://redirect.test';
process.env.COOKIE_SECURE = 'false';

// Creates the database + tables if needed and empties them
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
    await server.query(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db', 'schema.sql'), 'utf8'));
    await server.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ['clicks', 'links', 'users']) await server.query(`TRUNCATE TABLE ${table}`);
    await server.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await server.end();
  }
}

// Starts the real Express app on a free port
async function startServer() {
  const app = require('../src/app');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, server };
}

async function readBody(res, type) {
  if (type.includes('json')) return res.json();
  if (type.startsWith('image/')) return Buffer.from(await res.arrayBuffer());
  return res.text();
}

function encodeBody(body, raw) {
  if (raw || body === undefined) return body;
  return JSON.stringify(body);
}

// A tiny HTTP client that remembers the login cookie, like a browser would
function createClient(baseUrl) {
  let cookie = '';
  async function request(method, url, { body, headers = {}, raw = false } = {}) {
    const res = await fetch(baseUrl + url, {
      method,
      redirect: 'manual',
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }), ...headers },
      body: encodeBody(body, raw),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.startsWith('token=;') ? '' : setCookie.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, headers: res.headers, body: await readBody(res, type) };
  }
  return {
    get: (url, options) => request('GET', url, options),
    post: (url, body, options) => request('POST', url, { body, ...options }),
    patch: (url, body) => request('PATCH', url, { body }),
    delete: (url) => request('DELETE', url),
    forgetCookie: () => {
      cookie = '';
    },
  };
}

let counter = 0;
const uniqueEmail = () => `user${Date.now()}${counter++}@example.com`;

module.exports = { resetDatabase, startServer, createClient, uniqueEmail };
