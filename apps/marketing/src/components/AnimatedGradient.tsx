'use client'

/**
 * Animated brand gradient — two cross-fading colour layers + SVG turbulence
 * noise overlay. Ported from apps/web (auth layout). Use as a full-bleed
 * background inside a positioned container.
 */
export function AnimatedGradient() {
  // Inline SVG noise so we don't trigger an extra HTTP request.
  const noise =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter>" +
    "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"

  return (
    <>
      <div className="k2-gradient-root" aria-hidden="true">
        <div className="k2-gradient-noise" />
      </div>
      <style jsx>{`
        .k2-gradient-root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          isolation: isolate;
          background: #0a0f1f;
          z-index: 0;
        }
        .k2-gradient-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(900px 700px at 20% 30%, #4a7dff 0%, transparent 60%),
            radial-gradient(700px 600px at 85% 80%, #2952d9 0%, transparent 55%),
            linear-gradient(135deg, #1a3a8f 0%, #4a7dff 60%, #0a1a3f 100%);
          opacity: 1;
          animation: k2-fade-blue 16s ease-in-out infinite;
          will-change: opacity;
        }
        .k2-gradient-root::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(900px 700px at 80% 20%, #1a1a2e 0%, transparent 60%),
            radial-gradient(700px 600px at 15% 85%, #000000 0%, transparent 55%),
            linear-gradient(135deg, #000000 0%, #0a0a14 55%, #1f1f3a 100%);
          opacity: 0;
          animation: k2-fade-black 16s ease-in-out infinite;
          will-change: opacity;
        }
        .k2-gradient-noise {
          position: absolute;
          inset: -20%;
          z-index: 1;
          background-image: url("${noise}");
          background-size: 220px 220px;
          opacity: 0.28;
          mix-blend-mode: overlay;
          pointer-events: none;
          animation: k2-noise-pan 14s linear infinite;
          will-change: transform;
        }
        @keyframes k2-fade-blue {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes k2-fade-black {
          0%, 100% { opacity: 0; }
          50%      { opacity: 1; }
        }
        @keyframes k2-noise-pan {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-40px, -30px, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .k2-gradient-root::before,
          .k2-gradient-root::after,
          .k2-gradient-noise {
            animation: none;
          }
          .k2-gradient-root::after { opacity: 0.5; }
        }
      `}</style>
    </>
  )
}
