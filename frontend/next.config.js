/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['docs.bheem.cloud', 'workspace.bheem.cloud', 'office.bheem.cloud'],
  },
  async rewrites() {
    // NEXT_PUBLIC_API_URL should be the base backend URL (e.g., http://localhost:8000)
    // Remove any trailing /api/v1 if accidentally included
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    apiUrl = apiUrl.replace(/\/api\/v1\/?$/, '');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
      {
        // Proxy Drive API (for public share links)
        source: '/api/drive/:path*',
        destination: `${apiUrl}/api/drive/:path*`,
      },
      {
        // Proxy static files (logos, branding) from backend
        source: '/static/:path*',
        destination: `${apiUrl}/static/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Allow OnlyOffice to access logo files
        source: '/:path*.svg',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Allow OnlyOffice to access logo files (PNG fallback)
        source: '/:path*.png',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
