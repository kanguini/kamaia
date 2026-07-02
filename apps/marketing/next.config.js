/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Tree-shake icon imports: `import { Mail } from 'lucide-react'` already does
  // per-icon code-splitting in v0.453+, but enabling this also covers @radix-ui
  // and other libs that re-export everything.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Security headers (auditoria) — espelha o apps/web.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
