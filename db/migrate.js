// Applies db/schema.sql to the database in DATABASE_URL (safe to re-run: CREATE TABLE IF NOT EXISTS).
// Standalone: both services share the same schema, so this script loads its own env instead of
// depending on either service's config module.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing required environment variable: DATABASE_URL');
const dbSsl = process.env.DB_SSL === 'true';
const dbCaCert = process.env.DB_CA_CERT ? process.env.DB_CA_CERT.replaceAll(String.raw`\n`, '\n') : undefined;

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
