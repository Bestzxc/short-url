// Shared setup for the tests. Loaded FIRST in every test file: it points the app at a throw-away
// test database (never a real one) before any app code reads its configuration.
//
// Start a test MySQL once with:
//   docker run -d --name ziplink-test-db -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 3308:3306 mysql:8.4 --character-set-server=utf8mb4
// or point TEST_DATABASE_URL at any empty MySQL you do not mind losing the tables of.
//
// This service has no auth routes of its own, so tests that need a link seed one straight into
// the database (createTestLink below) instead of going through the API service.
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://root@127.0.0.1:3308/ziplink_test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DB_SSL = 'false';
process.env.FRONTEND_URL = 'http://frontend.test';

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
  return res.text();
}

// A tiny HTTP client (no cookies needed — every endpoint here is public)
function createClient(baseUrl) {
  async function request(method, url, { body, headers = {} } = {}) {
    const res = await fetch(baseUrl + url, {
      method,
      redirect: 'manual',
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, headers: res.headers, body: await readBody(res, type) };
  }
  return {
    get: (url, options) => request('GET', url, options),
    post: (url, body, options) => request('POST', url, { body, ...options }),
  };
}

let counter = 0;
const uniqueEmail = () => `user${Date.now()}${counter++}@example.com`;
const uniqueCode = () => `tc${Date.now().toString(36)}${counter++}`;

// Seeds one owner + one link directly in the database (bypassing the API service, which this
// service doesn't depend on) and returns its id, short_code and the plaintext link password (if any).
async function createTestLink(pool, overrides = {}) {
  const [user] = await pool.query('INSERT INTO users (email, password_hash) VALUES (?, ?)', [uniqueEmail(), 'x']);
  const shortCode = overrides.shortCode ?? uniqueCode();
  const linkPassword = overrides.password ?? null;
  const passwordHash = linkPassword ? await bcrypt.hash(linkPassword, 4) : null;
  const [result] = await pool.execute(
    `INSERT INTO links (user_id, title, original_url, short_code, link_password_hash, expires_at, max_clicks, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.insertId,
      overrides.title ?? null,
      overrides.originalUrl ?? 'https://example.com/page',
      shortCode,
      passwordHash,
      overrides.expiresAt ?? null,
      overrides.maxClicks ?? null,
      overrides.isActive ?? true,
    ],
  );
  return { linkId: result.insertId, shortCode, password: linkPassword };
}

module.exports = { resetDatabase, startServer, createClient, createTestLink };
