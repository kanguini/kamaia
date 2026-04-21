import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import Script from 'next/script'
import '@/styles/globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kamaia.cc'
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Kamaia · Plataforma estratégica de prática jurídica',
    template: '%s · Kamaia',
  },
  description:
    'Uma nova forma de ver a prática jurídica. Abordagem multidisciplinar que integra tecnologia, metodologias ágeis e assistente IA — do jurista-agente ao jurista-estratega.',
  keywords: [
    'plataforma jurídica',
    'gestão estratégica jurídica',
    'legal tech Angola',
    'gestão de escritórios de advogados',
    'gestão de processos jurídicos',
    'assistente IA jurídico',
    'metodologias ágeis direito',
  ],
  authors: [{ name: 'Kamaia' }],
  openGraph: {
    title: 'Kamaia · Plataforma estratégica de prática jurídica',
    description:
      'Uma abordagem multidisciplinar que faz do jurista não apenas um agente do direito, mas um baluarte da estratégia.',
    url: 'https://kamaia.cc',
    siteName: 'Kamaia',
    locale: 'pt',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kamaia · Plataforma estratégica de prática jurídica',
    description:
      'Agilidade, celeridade e inteligência nas decisões — sobre metodologias ágeis e IA contextual.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

// Structured data — identifies Kamaia as an Organization + the SaaS as a
// SoftwareApplication so Google can build a rich card.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#org`,
      name: 'Kamaia',
      url: SITE_URL,
      logo: `${SITE_URL}/og/logo-square.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'hello@kamaia.cc',
        contactType: 'customer service',
        availableLanguage: ['Portuguese'],
      },
      sameAs: [],
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Kamaia',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'LegalSoftware',
      operatingSystem: 'Web',
      description:
        'Plataforma estratégica de prática jurídica — integra gestão de processos, prazos, timesheets, facturação e assistente IA sob metodologias ágeis.',
      publisher: { '@id': `${SITE_URL}#org` },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {PLAUSIBLE_DOMAIN && (
          <Script
            strategy="afterInteractive"
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
