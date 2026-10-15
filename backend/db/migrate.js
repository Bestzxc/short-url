// Applies db/schema.sql to the database in DATABASE_URL (safe to re-run: CREATE TABLE IF NOT EXISTS)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { databaseUrl, dbSsl, dbCaCert } = require('../src/config');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    uri: databaseUrl,
    multipleStatements: true,
    ssl: dbSsl ? { rejectUnauthorized: true, ...(dbCaCert && { ca: dbCaCert }) } : undefined,
  });
  try {
    await conn.query(sql);
    console.log('Schema applied');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
