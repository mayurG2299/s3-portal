/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production'
const docsBase = (process.env.NEXT_PUBLIC_DOCS_URL || '/documentation').replace(/\/$/, '')

const nextConfig = {
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', '@ffmpeg-installer/ffmpeg'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
  },
  async rewrites() {
    return [
      { source: '/documentation', destination: '/documentation/self-hosting.html' },
      { source: '/documentation/aws-setup', destination: '/documentation/aws-setup.html' },
      { source: '/documentation/self-hosting', destination: '/documentation/self-hosting.html' },
    ]
  },
  async redirects() {
    return [
      {
        source: '/setup',
        destination: `${docsBase}/self-hosting`,
        permanent: true,
      },
      {
        source: '/help/aws-setup',
        destination: `${docsBase}/aws-setup`,
        permanent: true,
      },
      {
        source: '/help',
        destination: docsBase,
        permanent: true,
      },
      {
        source: '/help/:path*',
        destination: docsBase,
        permanent: true,
      },
    ]
  },
  output: 'standalone',
  
  // Production-only security headers
  ...(isProduction && {
    async headers() {
      return [
        {
          source: '/api/:path*',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-XSS-Protection', value: '1; mode=block' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          ],
        },
        {
          source: '/:path*',
          headers: [
            { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          ],
        },
      ]
    },
  }),
}

module.exports = nextConfig
