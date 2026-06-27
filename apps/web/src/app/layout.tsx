import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/components/providers/session-provider'
import { StyledJsxRegistry } from '@/components/providers/styled-jsx-registry'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/**
 * Geist Sans usada no redesign "Monolith Enterprise" do Dashboard.
 * Carregada via Google Fonts no <head> para evitar dependência
 * adicional no node_modules durante o rollout incremental. O
 * fallback do CSS é Inter, que já está carregada como fonte base.
 */
const GEIST_FONT_LINK = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link
      href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </>
)

export const metadata: Metadata = {
  title: 'Kamaia — Contract Lifecycle Management',
  description: 'CLM para Angola — gestão de contratos, compliance e IA jurídica.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
}

// Runs before the first paint: reads the stored theme and sets the
// .dark class only if explicitly chosen. Default = light, alinhado
// com o redesign Monolith Enterprise (which is light-first).
const THEME_BOOTSTRAP = `
(function(){try{
  var t = localStorage.getItem('kamaia-theme');
  if (t === 'dark') { document.documentElement.classList.add('dark'); }
}catch(e){}})();
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
        {GEIST_FONT_LINK}
      </head>
      <body className={inter.variable} style={{ fontFamily: 'Geist, Inter, -apple-system, system-ui, sans-serif' }}>
        <StyledJsxRegistry>
          <SessionProvider>{children}</SessionProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  )
}
