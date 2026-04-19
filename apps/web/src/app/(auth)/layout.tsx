/**
 * Auth layout — Kamaia 2.0.
 *
 * Split-screen: brand column (left) with illustration + value props, form
 * column (right) with the page's own content. Shared styles (inputs,
 * buttons, error/ok banners) are declared once here so each auth page
 * stays lean.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="k2-auth">
      <style>{`
        .k2-auth {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          min-height: 100vh;
          background: var(--k2-bg);
          color: var(--k2-text);
          font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-feature-settings: 'tnum', 'zero';
        }
        .k2-auth-brand {
          background: var(--k2-bg-elev);
          border-right: 1px solid var(--k2-border);
          display: flex;
          flex-direction: column;
          padding: 36px 48px;
          position: relative;
          overflow: hidden;
        }
        .k2-auth-mark { display: flex; align-items: center; gap: 12px; margin-bottom: auto; z-index: 2; position: relative; }
        .k2-auth-mark .m {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--k2-accent), var(--k2-accent-dim));
          display: grid; place-items: center;
          color: var(--k2-accent-fg);
          font-weight: 700; font-size: 17px; letter-spacing: -0.02em;
        }
        .k2-auth-mark .name { font-weight: 600; font-size: 16px; letter-spacing: -0.01em; }
        .k2-auth-mark .sub { font-size: 11px; color: var(--k2-text-dim); letter-spacing: 0.08em; text-transform: uppercase; }

        .k2-auth-lede { max-width: 420px; position: relative; z-index: 1; }
        .k2-auth-lede h2 {
          font-size: 40px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.04;
          margin: 0 0 16px; color: var(--k2-text);
        }
        .k2-auth-lede h2 em { font-style: normal; color: var(--k2-accent); }
        .k2-auth-lede p {
          color: var(--k2-text-dim); font-size: 14px; line-height: 1.6; margin: 0 0 28px;
        }
        .k2-auth-bullets {
          display: grid; gap: 10px; font-size: 13px; color: var(--k2-text-dim);
          list-style: none; padding: 0; margin: 0;
        }
        .k2-auth-bullets li { display: flex; align-items: center; gap: 10px; }
        .k2-auth-bullets li::before {
          content: ''; width: 5px; height: 5px; border-radius: 50%;
          background: var(--k2-accent); flex-shrink: 0;
        }

        .k2-auth-illu {
          position: absolute; right: -40px; bottom: -40px;
          width: 360px; height: 360px; opacity: 0.35; pointer-events: none;
        }
        .k2-auth-foot {
          margin-top: 40px; font-size: 11px; color: var(--k2-text-mute);
          letter-spacing: 0.04em; position: relative; z-index: 1;
        }

        .k2-auth-form {
          display: flex; align-items: center; justify-content: center;
          padding: 48px 32px;
        }
        .k2-auth-form > * { width: 100%; max-width: 380px; }

        .k2-auth input[type='text'],
        .k2-auth input[type='email'],
        .k2-auth input[type='password'] {
          width: 100%; padding: 9px 12px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text); font-size: 14px; font-family: inherit;
          transition: border-color 120ms, background 120ms, box-shadow 120ms;
        }
        .k2-auth input:focus-visible {
          outline: none; border-color: var(--k2-accent); background: var(--k2-bg);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--k2-accent) 22%, transparent);
        }
        .k2-auth input::placeholder { color: var(--k2-text-mute); }

        .k2-auth label.field {
          display: block; font-size: 11px; color: var(--k2-text-dim);
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 6px; font-weight: 500;
        }
        .k2-auth .field-error { font-size: 11px; color: var(--k2-bad); margin-top: 4px; }

        .k2-auth button.primary {
          width: 100%; padding: 10px 14px;
          background: var(--k2-accent); color: var(--k2-accent-fg);
          font-size: 14px; font-weight: 500;
          border: none; border-radius: var(--k2-radius-sm);
          cursor: pointer; transition: filter 120ms, opacity 120ms;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .k2-auth button.primary:hover:not(:disabled) { filter: brightness(1.08); }
        .k2-auth button.primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .k2-auth button.secondary {
          width: 100%; padding: 10px 14px;
          background: var(--k2-bg-elev); color: var(--k2-text);
          font-size: 14px; font-weight: 500;
          border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm);
          cursor: pointer; transition: all 120ms;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .k2-auth button.secondary:hover { border-color: var(--k2-border-strong); background: var(--k2-bg-hover); }

        .k2-auth h1 {
          font-size: 24px; font-weight: 600; letter-spacing: -0.02em;
          margin: 0 0 6px; color: var(--k2-text);
        }
        .k2-auth .lede {
          font-size: 13px; color: var(--k2-text-dim); margin: 0 0 24px;
        }
        .k2-auth .alt {
          margin-top: 20px; font-size: 13px; color: var(--k2-text-dim); text-align: center;
        }
        .k2-auth .alt a, .k2-auth .alt .link {
          color: var(--k2-accent); text-decoration: none; font-weight: 500;
          background: none; border: none; padding: 0; font: inherit; cursor: pointer;
        }
        .k2-auth .alt a:hover, .k2-auth .alt .link:hover { text-decoration: underline; }

        .k2-auth .error {
          padding: 10px 12px;
          background: color-mix(in oklch, var(--k2-bad) 12%, transparent);
          border: 1px solid color-mix(in oklch, var(--k2-bad) 35%, var(--k2-border));
          border-radius: var(--k2-radius-sm);
          color: var(--k2-bad); font-size: 13px; margin-bottom: 16px;
        }
        .k2-auth .ok {
          padding: 10px 12px;
          background: color-mix(in oklch, var(--k2-good) 12%, transparent);
          border: 1px solid color-mix(in oklch, var(--k2-good) 35%, var(--k2-border));
          border-radius: var(--k2-radius-sm);
          color: var(--k2-good); font-size: 13px; margin-bottom: 16px;
        }

        .k2-auth hr.or {
          border: none; border-top: 1px solid var(--k2-border);
          margin: 24px 0 16px; position: relative; text-align: center;
        }
        .k2-auth hr.or::after {
          content: 'ou'; position: absolute; top: -8px; left: 50%;
          transform: translateX(-50%); padding: 0 10px;
          background: var(--k2-bg); color: var(--k2-text-mute);
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
        }

        .k2-auth .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        @media (max-width: 900px) {
          .k2-auth { grid-template-columns: 1fr; }
          .k2-auth-brand { display: none; }
          .k2-auth-form { padding: 32px 24px; }
        }
      `}</style>

      <aside className="k2-auth-brand">
        <div className="k2-auth-mark">
          <div className="m">K</div>
          <div>
            <div className="name">Kamaia</div>
            <div className="sub">Gestão Jurídica</div>
          </div>
        </div>

        <div className="k2-auth-lede">
          <h2>
            A forma <em>inteligente</em> de gerir o teu gabinete.
          </h2>
          <p>
            Processos, prazos, timesheets, facturação e IA assistente numa
            só plataforma pensada para advogados angolanos.
          </p>
          <ul className="k2-auth-bullets">
            <li>Prazos em dias úteis com feriados nacionais</li>
            <li>Facturação automática com IVA 14%</li>
            <li>Projectos jurídicos com Gantt + burn-down</li>
            <li>IA Assistente para pesquisa e redacção</li>
          </ul>
        </div>

        <svg className="k2-auth-illu" viewBox="0 0 360 360" fill="none" aria-hidden="true">
          <g stroke="var(--k2-border-strong)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
            <rect x="80" y="70" width="140" height="180" rx="6" />
            <path d="M100 100 H200 M100 120 H210 M100 140 H180 M100 160 H200 M100 180 H190" opacity="0.6" />
          </g>
          <g stroke="var(--k2-border-strong)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} transform="translate(130 40) rotate(6)">
            <rect x="80" y="70" width="140" height="180" rx="6" fill="var(--k2-bg-elev)" />
            <path d="M100 100 H200 M100 120 H210 M100 140 H180 M100 160 H200" opacity="0.6" />
          </g>
          <g transform="translate(150 60) rotate(12)">
            <rect x="80" y="70" width="140" height="180" rx="6" fill="var(--k2-bg-elev)" stroke="var(--k2-accent)" strokeWidth={1.5} />
            <path d="M100 100 H200 M100 120 H210 M100 140 H180" opacity="0.7" stroke="var(--k2-accent)" strokeLinecap="round" strokeWidth={1.5} />
            <circle cx="180" cy="200" r="20" fill="var(--k2-accent)" opacity="0.15" />
            <path d="M170 200 L178 208 L192 193" stroke="var(--k2-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>

        <div className="k2-auth-foot">
          © {new Date().getFullYear()} Kamaia · Luanda, Angola
        </div>
      </aside>

      <section className="k2-auth-form">{children}</section>
    </div>
  )
}
