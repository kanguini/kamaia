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
}

module.exports = nextConfig
