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
  applicationName: 'Kamaia',
  keywords: [
    'plataforma jurídica',
    'gestão estratégica jurídica',
    'legal tech Angola',
    'software advogados Angola',
    'gestão de escritórios de advogados',
    'gestão de processos jurídicos',
    'assistente IA jurídico',
    'metodologias ágeis direito',
    'PALOP legal tech',
    'advocacia estratégica',
  ],
  authors: [{ name: 'Kamaia', url: SITE_URL }],
  creator: 'Kamaia',
  publisher: 'Kamaia',
  category: 'Legal Technology',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Kamaia · Plataforma estratégica de prática jurídica',
    description:
      'Uma abordagem multidisciplinar que faz do jurista não apenas um agente do direito, mas um baluarte da estratégia.',
    url: SITE_URL,
    siteName: 'Kamaia',
    locale: 'pt_AO',
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
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
}

export const viewport = {
  themeColor: '#0a0f1f',
  colorScheme: 'dark' as const,
  width: 'device-width',
  initialScale: 1,
}

// Structured data — identifies Kamaia as an Organization + the SaaS as a
// SoftwareApplication + WebSite (enables the Google Sitelinks Searchbox)
// so Google can build a rich card. FAQ JSON-LD lives on the homepage.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#org`,
      name: 'Kamaia',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon.svg`,
        width: 64,
        height: 64,
      },
      description:
        'Plataforma estratégica de prática jurídica. Abordagem multidisciplinar que integra tecnologia, metodologias ágeis e assistente IA para advogados, escritórios e gabinetes jurídicos.',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'hello@kamaia.cc',
        contactType: 'customer service',
        availableLanguage: ['Portuguese'],
        areaServed: ['AO', 'PT', 'MZ', 'CV', 'ST', 'GW'],
      },
      areaServed: [
        { '@type': 'Country', name: 'Angola' },
        { '@type': 'Country', name: 'Portugal' },
        { '@type': 'Country', name: 'Moçambique' },
        { '@type': 'Country', name: 'Cabo Verde' },
      ],
      foundingLocation: { '@type': 'Country', name: 'Angola' },
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'Kamaia',
      description:
        'Plataforma estratégica de prática jurídica para advogados, escritórios e gabinetes jurídicos em Angola e PALOP.',
      publisher: { '@id': `${SITE_URL}#org` },
      inLanguage: 'pt',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}#software`,
      name: 'Kamaia',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'LegalSoftware',
      operatingSystem: 'Web',
      url: SITE_URL,
      description:
        'Plataforma estratégica de prática jurídica — integra gestão de processos, prazos, timesheets, facturação e assistente IA sob metodologias ágeis.',
      featureList: [
        'Gestão de processos jurídicos',
        'Controlo de prazos com alertas multi-canal',
        'Timesheets e rentabilidade',
        'Facturação em AOA',
        'Assistente IA contextual',
        'Audit log append-only',
        'Isolamento multi-tenant',
      ],
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
