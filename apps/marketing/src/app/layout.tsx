import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import '@/styles/globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kamaia.cc'
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Kamaia · Gestão jurídica inteligente',
    template: '%s · Kamaia',
  },
  description:
    'Plataforma feita para advogados angolanos. Processos, prazos, timesheets e facturação num só lugar, com assistente IA que redige peças.',
  keywords: [
    'software advocacia angola',
    'gestão de processos jurídicos',
    'legal tech angola',
    'software advogados luanda',
    'gestão gabinete advogados',
  ],
  authors: [{ name: 'Kamaia' }],
  openGraph: {
    title: 'Kamaia · Gestão jurídica inteligente',
    description:
      'Processos, prazos, timesheets e facturação num só lugar. Feito para Angola.',
    url: 'https://kamaia.cc',
    siteName: 'Kamaia',
    locale: 'pt_AO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kamaia · Gestão jurídica inteligente',
    description: 'Processos, prazos e facturação num só lugar. Feito para Angola.',
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
        areaServed: 'AO',
        availableLanguage: ['Portuguese'],
      },
      areaServed: 'Angola',
      sameAs: [],
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Kamaia',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'LegalSoftware',
      operatingSystem: 'Web',
      description:
        'Plataforma de gestão jurídica para advogados angolanos — processos, prazos, timesheets, facturação e assistente IA.',
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
    <html lang="pt-AO" className={inter.variable}>
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
