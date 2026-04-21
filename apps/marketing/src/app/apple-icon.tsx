import { ImageResponse } from 'next/og'

// iOS home-screen icon. Next.js picks this up automatically and emits
// <link rel="apple-touch-icon" href="/apple-icon"> in the <head>.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'linear-gradient(135deg, #0a0f1f 0%, #141b30 60%, #1a2242 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
        }}
      >
        <svg width="120" height="96" viewBox="0 0 42.27 35.81">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b24aff" />
              <stop offset="100%" stopColor="#4a7dff" />
            </linearGradient>
          </defs>
          <polygon
            fill="url(#g)"
            points="42.27 35.81 32.47 35.81 22.03 18.77 16.94 27.08 8.36 27.08 8.36 35.81 0 35.81 0 0 8.36 0 8.36 25.07 23.72 0 33.52 0 22.83 17.47 31.03 17.47 42.27 35.81"
          />
        </svg>
      </div>
    ),
    size,
  )
}
