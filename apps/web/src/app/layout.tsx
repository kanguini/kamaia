import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/components/providers/session-provider'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kamaia',
  description: 'Gestão Jurídica Inteligente',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-AO">
      <body className={`${inter.variable} ${inter.className}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
