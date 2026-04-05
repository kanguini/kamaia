import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Mono, Instrument_Sans } from 'next/font/google'
import { SessionProvider } from '@/components/providers/session-provider'
import '@/styles/globals.css'

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-display',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kamaia',
  description: 'Gestao Juridica Inteligente',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-AO">
      <body
        className={`${cormorantGaramond.variable} ${dmMono.variable} ${instrumentSans.variable}`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
