const apiUrl = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const redirectApiUrl = (process.env.REDIRECT_API_URL || 'http://localhost:4002').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Proxy /api/* to the two backend services. The browser only ever talks to this domain, so the
  // auth cookie is first-party (works in Safari/iOS, which block third-party cookies).
  //   /api/public/*  -> the redirect service (unlock form for password-protected links)
  //   everything else under /api -> the api service (auth, links, stats)
  // Short-link visits (GET /:code) and QR codes bypass this proxy entirely and go straight to
  // the redirect service's own public origin — see lib/links.js's shortUrlFor on the api service.
  async rewrites() {
    return [
      { source: '/api/public/:path*', destination: `${redirectApiUrl}/api/public/:path*` },
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
