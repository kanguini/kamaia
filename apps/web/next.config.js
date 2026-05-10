/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kamaia/shared-types'],
  reactStrictMode: true,
  // Tree-shake heavy libs — lucide-react cobre ~all dashboard icons; radix
  // primitives são consumidos via shadcn/ui.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
    ],
  },
}

module.exports = nextConfig
