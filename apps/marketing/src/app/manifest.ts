import type { MetadataRoute } from 'next'

// Web app manifest — allows the marketing site to be installed as a PWA
// and declares the icon fleet. Next.js emits <link rel="manifest"> on
// every page automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kamaia — Contract Lifecycle Management para Angola',
    short_name: 'Kamaia',
    description:
      'CLM horizontal para Angola e PALOP. Imposto de Selo, registos, BNA e AGT automáticos. IA Q&A sobre legislação angolana.',
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
