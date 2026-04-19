import { Logo } from '@/components/ui/logo'

/**
 * Auth layout — Kamaia 2.0, fullscreen split.
 *
 * Whole viewport:
 *   - Left panel (55%): animated gradient that cross-fades between a blue
 *     family and a black/near-black family, with a grain overlay. Holds
 *     the Kamaia wordmark (top-left) and the two-line brand slogan
 *     (bottom-left). Infinite loop, `prefers-reduced-motion` disables it.
 *   - Right panel (45%): form content (page children).
 *
 * Collapses to a single column below 860px; the gradient becomes a short
 * banner at the top so the form remains the focus on mobile.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Data URI for an SVG turbulence noise (fractal noise, mix-blend: overlay).
  // Kept inline so no extra HTTP request is needed.
  const noise =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter>" +
    "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"

  return (
    <div className="k2-auth">
      <style>{`
        /* ── Root layout ── */
        .k2-auth {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          background: var(--k2-bg);
          color: var(--k2-text);
          font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-feature-settings: 'tnum', 'zero';
        }

        /* ── Brand panel (animated gradient) ── */
        .k2-auth-brand {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          color: #fff;
          padding: 40px 48px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 100vh;
          background: #0A0F1F;
        }

        /* Blue gradient layer */
        .k2-auth-brand::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(900px 700px at 20% 30%, #4A7DFF 0%, transparent 60%),
            radial-gradient(700px 600px at 85% 80%, #2952D9 0%, transparent 55%),
            linear-gradient(135deg, #1a3a8f 0%, #4A7DFF 60%, #0A1A3F 100%);
          opacity: 1;
          animation: k2-fade-blue 16s ease-in-out infinite;
          will-change: opacity;
        }

        /* Black gradient layer, cross-faded */
        .k2-auth-brand::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(900px 700px at 80% 20%, #1a1a2e 0%, transparent 60%),
            radial-gradient(700px 600px at 15% 85%, #000000 0%, transparent 55%),
            linear-gradient(135deg, #000000 0%, #0a0a14 55%, #1f1f3a 100%);
          opacity: 0;
          animation: k2-fade-black 16s ease-in-out infinite;
          will-change: opacity;
        }

        @keyframes k2-fade-blue {
          0%   { opacity: 1; }
          50%  { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes k2-fade-black {
          0%   { opacity: 0; }
          50%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Grain layer — noise texture that drifts slowly */
        .k2-auth-noise {
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
        @keyframes k2-noise-pan {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-40px, -30px, 0); }
        }

        .k2-auth-brand > * { position: relative; z-index: 2; }

        .k2-auth-slogan {
          max-width: 560px;
        }
        .k2-auth-slogan p {
          margin: 0;
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.025em;
          line-height: 1.15;
          color: #fff;
        }
        .k2-auth-slogan p + p { margin-top: 4px; }

        /* ── Form panel ── */
        .k2-auth-form {
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: var(--k2-bg);
        }
        .k2-auth-form > div.form-wrap {
          display: flex;
          flex-direction: column;
          max-width: 380px;
          margin: 0 auto;
          width: 100%;
        }

        /* Logo sits centred above the form card */
        .k2-auth-form-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 32px;
          color: var(--k2-text);
        }

        .k2-auth .glyph {
          color: var(--k2-accent);
          margin-bottom: 14px;
          display: inline-flex;
        }
        .k2-auth h1 {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0 0 6px;
          color: var(--k2-text);
        }
        .k2-auth .lede {
          font-size: 13px;
          color: var(--k2-text-dim);
          margin: 0 0 22px;
          line-height: 1.5;
        }

        /* ── Form controls ── */
        .k2-auth label.field {
          display: block;
          font-size: 12px;
          color: var(--k2-text);
          margin-bottom: 6px;
          font-weight: 500;
        }
        .k2-auth input[type='text'],
        .k2-auth input[type='email'],
        .k2-auth input[type='password'] {
          width: 100%;
          padding: 10px 12px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          font-size: 14px;
          font-family: inherit;
          transition: border-color 120ms, box-shadow 120ms, background 120ms;
        }
        .k2-auth input:focus-visible {
          outline: none;
          border-color: var(--k2-accent);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--k2-accent) 20%, transparent);
        }
        .k2-auth input::placeholder { color: var(--k2-text-mute); }

        .k2-auth .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .k2-auth .field-error {
          font-size: 11px;
          color: var(--k2-bad);
          margin-top: 4px;
        }

        /* ── Buttons ── */
        .k2-auth button.primary {
          width: 100%;
          padding: 11px 14px;
          background: var(--k2-text);
          color: var(--k2-bg);
          font-size: 14px;
          font-weight: 500;
          border: none;
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          transition: filter 120ms, opacity 120ms;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
        }
        .k2-auth button.primary:hover:not(:disabled) { filter: brightness(0.92); }
        .k2-auth button.primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .k2-auth button.secondary {
          width: 100%;
          padding: 10px 14px;
          background: var(--k2-bg);
          color: var(--k2-text);
          font-size: 14px;
          font-weight: 500;
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          transition: all 120ms;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .k2-auth button.secondary:hover {
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-elev);
        }

        /* ── Social row ── */
        .k2-auth .or {
          text-align: center;
          font-size: 12px;
          color: var(--k2-text-mute);
          margin: 18px 0 12px;
          position: relative;
        }
        .k2-auth .or::before,
        .k2-auth .or::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 30%;
          height: 1px;
          background: var(--k2-border);
        }
        .k2-auth .or::before { left: 0; }
        .k2-auth .or::after { right: 0; }

        .k2-auth .socials {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .k2-auth .socials button {
          padding: 10px 12px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 120ms;
          color: var(--k2-text);
          font-size: 13px;
          font-weight: 500;
        }
        .k2-auth .socials button:hover:not(:disabled) {
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-elev);
        }
        .k2-auth .socials button:disabled { opacity: 0.5; cursor: not-allowed; }
        .k2-auth .socials svg { width: 18px; height: 18px; flex-shrink: 0; }

        .k2-auth .alt {
          margin-top: 22px;
          font-size: 13px;
          color: var(--k2-text-dim);
          text-align: center;
        }
        .k2-auth .alt a,
        .k2-auth .alt .link {
          color: var(--k2-accent);
          text-decoration: none;
          font-weight: 500;
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          cursor: pointer;
        }
        .k2-auth .alt a:hover,
        .k2-auth .alt .link:hover { text-decoration: underline; }

        .k2-auth .error {
          padding: 10px 12px;
          background: color-mix(in oklch, var(--k2-bad) 12%, transparent);
          border: 1px solid color-mix(in oklch, var(--k2-bad) 35%, var(--k2-border));
          border-radius: var(--k2-radius-sm);
          color: var(--k2-bad);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .k2-auth .ok {
          padding: 10px 12px;
          background: color-mix(in oklch, var(--k2-good) 12%, transparent);
          border: 1px solid color-mix(in oklch, var(--k2-good) 35%, var(--k2-border));
          border-radius: var(--k2-radius-sm);
          color: var(--k2-good);
          font-size: 13px;
          margin-bottom: 16px;
        }

        /* ── Responsive: stack on narrow viewports ── */
        @media (max-width: 860px) {
          .k2-auth { grid-template-columns: 1fr; }
          .k2-auth-brand {
            min-height: auto;
            padding: 28px 28px 36px;
            gap: 24px;
          }
          .k2-auth-slogan p { font-size: 22px; }
          .k2-auth-form { padding: 32px 24px 48px; }
        }

        /* ── Motion preferences ── */
        @media (prefers-reduced-motion: reduce) {
          .k2-auth-brand::before,
          .k2-auth-brand::after,
          .k2-auth-noise {
            animation: none;
          }
          .k2-auth-brand::after { opacity: 0.5; }
        }
      `}</style>

      {/* Brand panel — animated gradient + noise */}
      <aside className="k2-auth-brand">
        <div className="k2-auth-noise" aria-hidden="true" />
        <div className="k2-auth-slogan">
          <p>Gestão jurídica inteligente,</p>
          <p>Pessoas, Processos e Tecnologia</p>
        </div>
      </aside>

      {/* Form panel */}
      <section className="k2-auth-form">
        <div className="form-wrap">
          <div className="k2-auth-form-logo">
            <Logo height={32} />
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
