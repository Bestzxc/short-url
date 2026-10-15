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

    // CREATE TABLE IF NOT EXISTS does not touch existing tables, so add columns introduced later
    const [titleColumn] = await conn.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'links' AND COLUMN_NAME = 'title'",
    );
    if (titleColumn.length === 0) {
      await conn.query('ALTER TABLE links ADD COLUMN title VARCHAR(100) NULL AFTER user_id');
      console.log('Added links.title');
    }
    console.log('Schema applied');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
