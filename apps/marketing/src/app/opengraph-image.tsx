import { ImageResponse } from 'next/og'

// Open Graph card — shown when kamaia.cc is shared on LinkedIn, WhatsApp,
// Facebook, Messenger, etc. Next.js auto-adds the og:image meta tag.
export const alt =
  'Kamaia — Plataforma estratégica de prática jurídica. Uma nova forma de ver a prática jurídica.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background:
            'linear-gradient(135deg, #05080f 0%, #0a0f1f 55%, #141b30 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 700,
            height: 700,
            borderRadius: 9999,
            background:
              'radial-gradient(ellipse, rgba(74,125,255,0.28) 0%, rgba(178,74,255,0.08) 45%, transparent 75%)',
            display: 'flex',
          }}
        />

        {/* Top row: mark + wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            zIndex: 2,
          }}
        >
          <svg width="56" height="48" viewBox="0 0 42.27 35.81">
            <defs>
              <linearGradient id="gmark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#b24aff" />
                <stop offset="100%" stopColor="#4a7dff" />
              </linearGradient>
            </defs>
            <polygon
              fill="url(#gmark)"
              points="42.27 35.81 32.47 35.81 22.03 18.77 16.94 27.08 8.36 27.08 8.36 35.81 0 35.81 0 0 8.36 0 8.36 25.07 23.72 0 33.52 0 22.83 17.47 31.03 17.47 42.27 35.81"
            />
          </svg>
          <span
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: 2,
            }}
          >
            KAMAIA
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 18,
              textTransform: 'uppercase',
              letterSpacing: 3,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: '#6be49a',
              }}
            />
            Plataforma estratégica de prática jurídica
          </div>

          <div
            style={{
              fontSize: 78,
              fontWeight: 500,
              color: '#ffffff',
              lineHeight: 1.05,
              letterSpacing: -1.8,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Uma nova forma de ver</span>
            <span style={{ color: '#9cb6ff' }}>a prática jurídica.</span>
          </div>

          <div
            style={{
              fontSize: 26,
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 960,
              lineHeight: 1.4,
              marginTop: 8,
              display: 'flex',
            }}
          >
            Agilidade, celeridade e inteligência nas decisões — sob
            metodologias ágeis e assistente IA contextual.
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: 20,
            color: 'rgba(255,255,255,0.55)',
            zIndex: 2,
          }}
        >
          <span>kamaia.cc</span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, #b24aff, #4a7dff)',
              color: '#fff',
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            Programa de early access
          </span>
        </div>
      </div>
    ),
    size,
  )
}
