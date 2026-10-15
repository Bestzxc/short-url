const mysql = require('mysql2/promise');
const { databaseUrl, dbSsl, dbCaCert } = require('./config');

const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  // Read/write DATETIME as UTC so expiry checks don't depend on the server's timezone
  timezone: 'Z',
  // Hosted MySQL (Aiven, TiDB Cloud) requires TLS; Aiven also needs its CA certificate
  ssl: dbSsl ? { rejectUnauthorized: true, ...(dbCaCert && { ca: dbCaCert }) } : undefined,
});

// Make CURRENT_TIMESTAMP defaults UTC too, matching the driver setting above
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

module.exports = pool;
