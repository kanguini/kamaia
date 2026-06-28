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
    default: 'Kamaia · Contract Lifecycle Management para Angola',
    template: '%s · Kamaia',
  },
  description:
    'Gestão do ciclo de vida de contratos para empresas angolanas. Crie de raiz ou herde a carteira que já existe — com renovações, obrigações e compliance angolano (Imposto de Selo, registos, BNA, AGT) tratados de origem, e um conselheiro de IA sobre a legislação local.',
  applicationName: 'Kamaia',
  keywords: [
    'Contract Lifecycle Management Angola',
    'CLM Angola',
    'gestão de contratos',
    'compliance Imposto de Selo Angola',
    'TGIS automático',
    'BNA RJOC operações cambiais',
    'AGT retenção IRT',
    'legal tech Angola',
    'PALOP CLM',
    'software contratos empresas Angola',
    'sociedades advogados CLM',
  ],
  authors: [{ name: 'Kamaia', url: SITE_URL }],
  creator: 'Kamaia',
  publisher: 'Kamaia',
  category: 'Contract Management Software',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Kamaia · Gestão do ciclo de vida de contratos para Angola',
    description:
      'Crie de raiz ou herde a carteira que já existe. O ciclo de vida do contrato, do primeiro acto ao último, com o compliance angolano tratado de origem.',
    url: SITE_URL,
    siteName: 'Kamaia',
    locale: 'pt_AO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kamaia · CLM para Angola',
    description:
      'Contract Lifecycle Management com compliance angolano embebido. IA jurídica com citação ao artigo.',
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
        'Contract Lifecycle Management horizontal para Angola e PALOP. Compliance angolano embebido — TGIS, registos, BNA, AGT — com IA Q&A sobre legislação local.',
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
        'Contract Lifecycle Management para empresas e sociedades de advogados em Angola e PALOP.',
      publisher: { '@id': `${SITE_URL}#org` },
      inLanguage: 'pt',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}#software`,
      name: 'Kamaia',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'ContractLifecycleManagement',
      operatingSystem: 'Web',
      url: SITE_URL,
      description:
        'Contract Lifecycle Management horizontal — gere contratos da solicitação ao arquivo, com Imposto de Selo, registos, BNA e AGT calculados automaticamente e IA sobre legislação angolana.',
      featureList: [
        'Ciclo de vida completo (17 estados)',
        'Compliance angolano embebido (IS, Registos, BNA, AGT, Notário)',
        'IA Q&A sobre legislação com citações',
        'Importação em massa de carteira legada',
        'Multi-tenant hierárquico (modo Agency)',
        'Biblioteca de cláusulas e templates',
        'Webhooks com HMAC + alertas multi-canal',
        'Audit log append-only',
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
    <html lang="pt-AO" className={`${inter.variable} ${playfair.variable}`}>
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
