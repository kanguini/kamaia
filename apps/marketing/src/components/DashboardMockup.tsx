'use client'

/**
 * Stylised inline mockup of the Kamaia dashboard. Used wherever a screenshot
 * would land — gets swapped for a real PNG (via scripts/capture-screenshots)
 * once credentials are set in production.
 *
 * Advantage of staying SVG: crisp at any DPR, no image loading cost, no
 * flash when theme toggles.
 */
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="k2-mock">
        {/* Chrome */}
        <div className="k2-mock-chrome">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span className="url">app.kamaia.ao</span>
        </div>

        <div className="k2-mock-body">
          {/* Sidebar */}
          <aside className="k2-mock-sidebar">
            <div className="k2-mock-brand">KAMAIA</div>
            <div className="k2-mock-subtitle">GMS ADVOGADOS</div>
            <div className="k2-mock-nav-label">TRABALHO</div>
            <NavRow label="Dashboard" active />
            <NavRow label="Projectos" count={3} />
            <NavRow label="Processos" count={12} />
            <NavRow label="Clientes" count={28} />
            <NavRow label="Agenda" />
            <NavRow label="Prazos" count={4} urgent />
            <NavRow label="Documentos" />
            <NavRow label="Timesheets" />
            <NavRow label="Facturas" />
          </aside>

          {/* Main */}
          <section className="k2-mock-main">
            <div className="k2-mock-topbar">
              <span className="crumb">Início / Dashboard</span>
              <span className="search">Pesquisar processos, clientes, prazos…</span>
              <span className="pill-ai">✦ IA</span>
            </div>

            <div className="k2-mock-hero">
              <div className="lede">— Domingo, 19 de Abril</div>
              <h3>
                Boa tarde, Helder. <em>2 prazos</em> esta semana.
              </h3>
              <p>65.0k AKZ em dívida · 1 factura(s) por liquidar.</p>
            </div>

            <div className="k2-mock-strip">
              <Stat label="Facturado · Abril" value="65.0k" unit="AKZ" />
              <Stat label="Em dívida" value="65.0k" unit="AKZ" tone="bad" />
              <Stat label="WIP por facturar" value="6.6M" unit="AKZ" tone="good" />
              <Stat label="Projectos activos" value="3" />
            </div>

            <div className="k2-mock-grid">
              <div>
                <div className="k2-mock-section-label">CAPACIDADE · ESTA SEMANA</div>
                <div className="k2-mock-ring">
                  <svg viewBox="0 0 100 100" width="140" height="140">
                    <circle cx="50" cy="50" r="42" stroke="var(--k2-bg-hover)" strokeWidth="4" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="var(--k2-accent)"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${(22 / 100) * (2 * Math.PI * 42)} ${2 * Math.PI * 42}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="k2-mock-ring-body">
                    <div className="big">20.5<span className="u">/94h</span></div>
                    <div className="desc">22% das horas facturáveis consumidas</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="k2-mock-section-label">AGENDA DO MÊS</div>
                <div className="k2-mock-cal-head">
                  <span className="arrow">‹</span>
                  <span className="title">Abril</span>
                  <span className="arrow">›</span>
                </div>
                <div className="k2-mock-cal">
                  {Array.from({ length: 35 }).map((_, i) => {
                    const day = i - 2
                    const isToday = day === 19
                    const urgent = [14, 21].includes(day)
                    const prazo = [8, 25].includes(day)
                    const event = [6, 11, 17, 28].includes(day)
                    const out = day < 1 || day > 30
                    return (
                      <div
                        key={i}
                        className={[
                          'cell',
                          out ? 'out' : '',
                          isToday ? 'today' : '',
                          urgent ? 'urgent' : '',
                          prazo ? 'prazo' : '',
                          event ? 'event' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {out ? '' : day}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .k2-mock {
          width: 100%;
          border-radius: 16px;
          overflow: hidden;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          box-shadow:
            0 1px 0 0 rgba(255, 255, 255, 0.03) inset,
            0 24px 80px -24px rgba(74, 125, 255, 0.35),
            0 60px 120px -40px rgba(0, 0, 0, 0.6);
        }
        .k2-mock-chrome {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px;
          background: #111;
          border-bottom: 1px solid var(--k2-border);
        }
        .k2-mock-chrome .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #333;
        }
        .k2-mock-chrome .dot:nth-child(1) {
          background: #ff5f56;
        }
        .k2-mock-chrome .dot:nth-child(2) {
          background: #ffbd2e;
        }
        .k2-mock-chrome .dot:nth-child(3) {
          background: #27c93f;
        }
        .k2-mock-chrome .url {
          margin-left: 10px;
          font-size: 11px;
          color: #777;
          font-family: ui-monospace, Menlo, monospace;
        }

        .k2-mock-body {
          display: grid;
          grid-template-columns: 180px 1fr;
          min-height: 420px;
        }

        .k2-mock-sidebar {
          background: var(--k2-bg-elev);
          border-right: 1px solid var(--k2-border);
          padding: 14px 10px;
          font-size: 11px;
        }
        .k2-mock-brand {
          color: #fff;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.1em;
          padding: 0 6px;
          margin-bottom: 2px;
        }
        .k2-mock-subtitle {
          color: var(--k2-text-mute);
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0 6px;
          margin-bottom: 16px;
        }
        .k2-mock-nav-label {
          font-size: 8px;
          color: var(--k2-text-mute);
          letter-spacing: 0.12em;
          padding: 0 6px 6px;
        }
        .k2-mock-main {
          padding: 16px 18px;
        }
        .k2-mock-topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 12px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--k2-border);
          font-size: 11px;
        }
        .k2-mock-topbar .crumb {
          color: var(--k2-text-dim);
        }
        .k2-mock-topbar .search {
          flex: 1;
          padding: 5px 10px;
          border: 1px solid var(--k2-border);
          border-radius: 6px;
          color: var(--k2-text-mute);
          font-size: 10px;
        }
        .k2-mock-topbar .pill-ai {
          padding: 3px 9px;
          border-radius: 999px;
          background: linear-gradient(135deg, #b24aff, #4a7dff);
          color: #fff;
          font-size: 10px;
          font-weight: 500;
        }
        .k2-mock-hero .lede {
          font-size: 9px;
          color: var(--k2-text-mute);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .k2-mock-hero h3 {
          margin: 0 0 4px;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: var(--k2-text);
        }
        .k2-mock-hero h3 em {
          font-style: normal;
          color: var(--k2-accent);
        }
        .k2-mock-hero p {
          font-size: 10px;
          color: var(--k2-text-dim);
          margin: 0 0 12px;
        }
        .k2-mock-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }
        .k2-mock-section-label {
          font-size: 8px;
          color: var(--k2-text-mute);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .k2-mock-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 18px;
        }
        .k2-mock-ring {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .k2-mock-ring-body .big {
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.03em;
        }
        .k2-mock-ring-body .big .u {
          font-size: 10px;
          color: var(--k2-text-mute);
          margin-left: 3px;
        }
        .k2-mock-ring-body .desc {
          font-size: 10px;
          color: var(--k2-text-dim);
          max-width: 140px;
          margin-top: 3px;
          line-height: 1.4;
        }
        .k2-mock-cal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 10px;
          color: var(--k2-text);
        }
        .k2-mock-cal-head .arrow {
          width: 16px;
          height: 16px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid var(--k2-border);
          color: var(--k2-text-mute);
          font-size: 10px;
        }
        .k2-mock-cal {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .k2-mock-cal .cell {
          height: 20px;
          border-radius: 4px;
          display: grid;
          place-items: center;
          font-size: 9px;
          color: var(--k2-text);
        }
        .k2-mock-cal .cell.out {
          opacity: 0.25;
        }
        .k2-mock-cal .cell.today {
          background: var(--k2-text);
          color: var(--k2-bg);
          font-weight: 600;
        }
        .k2-mock-cal .cell.urgent {
          background: color-mix(in oklch, var(--k2-bad) 35%, transparent);
        }
        .k2-mock-cal .cell.prazo {
          background: color-mix(in oklch, var(--k2-accent) 25%, transparent);
        }
        .k2-mock-cal .cell.event {
          background: color-mix(in oklch, var(--k2-text-mute) 20%, transparent);
        }
      `}</style>
    </div>
  )
}

function NavRow({ label, active, count, urgent }: { label: string; active?: boolean; count?: number; urgent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 6px',
        borderRadius: 4,
        color: active ? 'var(--k2-text)' : 'var(--k2-text-dim)',
        background: active ? 'var(--k2-bg-hover)' : 'transparent',
        fontSize: 11,
      }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 9,
            color: urgent ? 'var(--k2-bad)' : 'var(--k2-text-mute)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'good' | 'bad' }) {
  return (
    <div
      style={{
        padding: '10px 0',
        borderRight: '1px solid var(--k2-border)',
        paddingRight: 14,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: 'var(--k2-text-mute)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color:
            tone === 'good'
              ? 'var(--k2-good)'
              : tone === 'bad'
                ? 'var(--k2-bad)'
                : 'var(--k2-text)',
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{unit}</span>
        )}
      </div>
    </div>
  )
}
