import type { MetadataRoute } from 'next'

// Web app manifest — allows the marketing site to be installed as a PWA
// and declares the icon fleet. Next.js emits <link rel="manifest"> on
// every page automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kamaia — Plataforma estratégica de prática jurídica',
    short_name: 'Kamaia',
    description:
      'Uma nova forma de ver a prática jurídica. Abordagem multidisciplinar, metodologias ágeis e assistente IA contextual.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0f1f',
    theme_color: '#0a0f1f',
    lang: 'pt',
    categories: ['business', 'productivity', 'legal'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
