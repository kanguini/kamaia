'use client'

/**
 * Subtle brand backdrop — static, near-black with very faint navy accents.
 *
 * Previous revisions cross-faded a bright blue wash; it bled around the
 * mockup on wider viewports and clashed with the institutional tone. Now
 * we stay close to #0a0f1f with small atmospheric radials and no
 * animation. Kept as a client component for consistency with earlier
 * imports across the site.
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
              800px 500px at 50% 0%,
              rgba(74, 125, 255, 0.1) 0%,
              transparent 70%
            ),
            radial-gradient(
              600px 400px at 50% 100%,
              rgba(178, 74, 255, 0.05) 0%,
              transparent 65%
            ),
            #05080f;
        }
      `}</style>
    </div>
  )
}
