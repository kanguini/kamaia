import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://kamaia.ao'),
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
    url: 'https://kamaia.ao',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-AO" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
