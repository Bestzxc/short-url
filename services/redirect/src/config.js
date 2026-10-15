require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required('DATABASE_URL'),
  dbSsl: process.env.DB_SSL === 'true',
  // PEM content of the provider's CA certificate (\n escapes allowed for single-line env vars)
  dbCaCert: process.env.DB_CA_CERT ? process.env.DB_CA_CERT.replaceAll(String.raw`\n`, '\n') : undefined,
  // Where visitors are sent for /status/<state> and /unlock/<code> (this service never serves
  // those pages itself — it only decides which one to redirect to)
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
};
