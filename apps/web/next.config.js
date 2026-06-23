/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kamaia/shared-types'],
  reactStrictMode: true,
  // Esconde o "build activity / errors" floater do Next.js no
  // canto inferior esquerdo. O ecrã do utilizador não deve ter
  // overlays de dev tooling em produção.
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
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
