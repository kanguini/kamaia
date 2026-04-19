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
    default: 'Kamaia · Gestão jurídica inteligente',
    template: '%s · Kamaia',
  },
  description:
    'Plataforma completa para advogados, escritórios e gabinetes jurídicos. Processos, prazos, timesheets e facturação num só lugar, com assistente IA.',
  keywords: [
    'software gestão jurídica',
    'gestão de processos jurídicos',
    'legal tech',
    'software advogados',
    'gestão gabinete advogados',
    'plataforma jurídica',
    'timesheets advocacia',
  ],
  authors: [{ name: 'Kamaia' }],
  openGraph: {
    title: 'Kamaia · Gestão jurídica inteligente',
    description:
      'Processos, prazos, timesheets e facturação num só lugar. Com assistente IA integrado.',
    url: 'https://kamaia.cc',
    siteName: 'Kamaia',
    locale: 'pt',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kamaia · Gestão jurídica inteligente',
    description: 'Processos, prazos e facturação num só lugar. Assistente IA integrado.',
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
        'Plataforma de gestão jurídica para advogados, escritórios e gabinetes — processos, prazos, timesheets, facturação e assistente IA.',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'AOA',
        lowPrice: '0',
        highPrice: '45000',
        offerCount: 4,
      },
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
