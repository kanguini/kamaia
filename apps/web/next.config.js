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
  // Security headers (auditoria): o dashboard autenticado era frameável
  // (clickjacking) e sem política de referrer/sniffing. CSP fica para
  // uma fase posterior (styled-jsx exige 'unsafe-inline' — carece de
  // análise própria antes de activar).
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
  // Onda C.3.1: redirects server-side em vez de client-side useEffect.
  // Mais rápido (sem flash), SEO-friendly, e funciona para curl/bots.
  async redirects() {
    return [
      {
        // Sprint 3.2 moveu Tipos de Contrato para /biblioteca/tipos
        source: '/configuracoes/tipos-contrato',
        destination: '/biblioteca/tipos',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
