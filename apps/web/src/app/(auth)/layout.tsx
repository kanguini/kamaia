/**
 * Auth layout — Kamaia 2.0, card-style.
 *
 * Outer page: soft neutral backdrop (bg-elev). A single rounded card
 * sits centred in the viewport with two columns inside:
 *   - Left panel (55%): accent gradient with brand mark top-left and a
 *     marketing tagline bottom-left.
 *   - Right panel (45%): form content — accent glyph, heading, lede,
 *     fields, primary action, "or continue with" divider and optional
 *     social auth buttons.
 * Responsive collapses to a single-column card below 860px.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="k2-auth">
      <style>{`
        /* ── Outer page ── */
        .k2-auth {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px;
          background: var(--k2-bg-elev);
          color: var(--k2-text);
          font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-feature-settings: 'tnum', 'zero';
        }

        /* ── Card ── */
        .k2-auth-card {
          width: min(960px, 100%);
          min-height: 560px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: 18px;
          overflow: hidden;
          box-shadow:
            0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
            0 20px 60px -20px rgba(0, 0, 0, 0.25);
        }

        /* ── Brand panel (left) ── */
        .k2-auth-brand {
          position: relative;
          padding: 28px 32px;
          color: var(--k2-accent-fg);
          background:
            radial-gradient(circle at 70% 30%, color-mix(in oklch, var(--k2-accent) 85%, #000) 0%, transparent 55%),
            radial-gradient(circle at 20% 85%, color-mix(in oklch, var(--k2-accent-dim) 70%, #000) 0%, transparent 50%),
            linear-gradient(135deg, var(--k2-accent-dim) 0%, var(--k2-accent) 55%, color-mix(in oklch, var(--k2-accent) 70%, #fff) 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          isolation: isolate;
        }
        /* Soft light overlay for depth */
        .k2-auth-brand::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(600px 400px at 110% -10%, rgba(255, 255, 255, 0.22), transparent 60%),
            radial-gradient(500px 350px at -10% 120%, rgba(0, 0, 0, 0.18), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }
        .k2-auth-mark {
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 1;
          position: relative;
        }
        .k2-auth-mark .m {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          display: grid;
          place-items: center;
          color: var(--k2-accent-fg);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: -0.02em;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
        }
        .k2-auth-mark .name {
          font-weight: 600;
          font-size: 15px;
          letter-spacing: -0.01em;
        }

        .k2-auth-tagline {
          position: relative;
          z-index: 1;
          max-width: 340px;
        }
        .k2-auth-tagline-sup {
          font-size: 13px;
          opacity: 0.85;
          margin-bottom: 6px;
        }
        .k2-auth-tagline h2 {
          margin: 0;
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.025em;
          line-height: 1.12;
          color: var(--k2-accent-fg);
        }

        /* ── Form panel (right) ── */
        .k2-auth-form {
          padding: 36px 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .k2-auth-form > div.form-wrap {
          display: flex;
          flex-direction: column;
          max-width: 340px;
          margin: 0 auto;
          width: 100%;
        }

        .k2-auth .glyph {
          color: var(--k2-accent);
          margin-bottom: 14px;
          display: inline-flex;
        }
        .k2-auth h1 {
          font-size: 26px;
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
          width: 32%;
          height: 1px;
          background: var(--k2-border);
        }
        .k2-auth .or::before { left: 0; }
        .k2-auth .or::after { right: 0; }

        .k2-auth .socials {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .k2-auth .socials button {
          padding: 10px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 120ms;
          color: var(--k2-text);
        }
        .k2-auth .socials button:hover {
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-elev);
        }
        .k2-auth .socials svg { width: 18px; height: 18px; }

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

        @media (max-width: 860px) {
          .k2-auth-card { grid-template-columns: 1fr; min-height: auto; }
          .k2-auth-brand {
            padding: 22px 24px;
            min-height: 180px;
          }
          .k2-auth-form { padding: 28px 24px 32px; }
        }
      `}</style>

      <div className="k2-auth-card">
        {/* Brand panel */}
        <aside className="k2-auth-brand">
          <div className="k2-auth-mark">
            <div className="m">K</div>
            <div className="name">Kamaia</div>
          </div>

          <div className="k2-auth-tagline">
            <div className="k2-auth-tagline-sup">Gestão jurídica inteligente</div>
            <h2>
              Processos, prazos, facturação e equipa — num só fluxo.
            </h2>
          </div>
        </aside>

        {/* Form panel */}
        <section className="k2-auth-form">
          <div className="form-wrap">{children}</div>
        </section>
      </div>
    </div>
  )
}
