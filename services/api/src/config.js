require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  isProduction,
  // Secure cookies need HTTPS. Defaults to on in production; set COOKIE_SECURE=false to run over plain http
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required('DATABASE_URL'),
  dbSsl: process.env.DB_SSL === 'true',
  // PEM content of the provider's CA certificate (\n escapes allowed for single-line env vars)
  dbCaCert: process.env.DB_CA_CERT ? process.env.DB_CA_CERT.replaceAll(String.raw`\n`, '\n') : undefined,
  jwtSecret: required('JWT_SECRET'),
  // Origin of the Next.js app (CORS)
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  // Public origin of the redirect service — this API doesn't serve short links itself, it just
  // needs to know where they resolve so it can build shortUrl strings and QR codes.
  redirectBaseUrl: (process.env.REDIRECT_BASE_URL || 'http://localhost:4002').replace(/\/$/, ''),
};
