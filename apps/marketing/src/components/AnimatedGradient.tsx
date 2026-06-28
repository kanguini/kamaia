'use client'

/**
 * Subtle brand backdrop — light theme. A near-white field with two very
 * faint cool radials (navy / violet) anchoring the top and bottom of the
 * hero, so the orb has air to glow into without the page feeling flat.
 * Static, no animation; kept as a client component for import parity.
 */
export function AnimatedGradient() {
  return (
    <div className="k2-gradient-root" aria-hidden="true">
      <style jsx>{`
        .k2-gradient-root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          isolation: isolate;
          z-index: 0;
          background:
            radial-gradient(
              900px 520px at 50% -5%,
              rgba(52, 96, 217, 0.08) 0%,
              transparent 70%
            ),
            radial-gradient(
              640px 420px at 50% 105%,
              rgba(124, 92, 255, 0.05) 0%,
              transparent 65%
            ),
            #ffffff;
        }
      `}</style>
    </div>
  )
}
