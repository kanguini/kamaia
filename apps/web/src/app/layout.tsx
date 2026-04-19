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
  title: 'Kamaia — Gestão Jurídica Inteligente',
  description: 'Plataforma de gestão jurídica para advogados e gabinetes em Angola',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
}

// Runs before the first paint: reads the stored theme (default dark) and sets
// the .dark class on <html> so the k2 tokens resolve to the right palette
// immediately. Without this, the page renders in the :root (light) variables
// for a tick, then flashes to dark once the client hydrates.
const THEME_BOOTSTRAP = `
(function(){try{
  var t = localStorage.getItem('kamaia-theme');
  if (t !== 'light') { document.documentElement.classList.add('dark'); }
}catch(e){ document.documentElement.classList.add('dark'); }})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-AO" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${inter.variable} ${inter.className}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
