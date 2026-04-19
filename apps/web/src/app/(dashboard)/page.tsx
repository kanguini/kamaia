'use client'

/**
 * Kamaia 2.0 Dashboard — re-implementation of the Claude Design
 * "kamaia-2-0/project/Dashboard.html" prototype, wired to real data.
 *
 * Layout blocks:
 *   Hero band         → saudação + frase-chave + ilustração SVG
 *   Stats strip       → 4 stats horizontais (Facturado / Em dívida / WIP / Projectos)
 *   Capacity ring     → 87% das horas facturáveis consumidas
 *   Deadline timeline → calendário de 14 dias com dots por urgência
 *   Projects gantt    → barras horizontais para projectos activos
 *   Quick actions     → atalhos secundários à direita
 *
 * All visuals use k2-* CSS vars from globals.css. Data comes from the
 * existing executive endpoint plus light top-up queries for the calendar
 * and gantt.
 */

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

// ─────────────────────────────────────────────────────────────
// Types (match existing endpoints)
// ─────────────────────────────────────────────────────────────
interface ExecutiveDashboard {
  financial: {
    revenueBilledThisMonth: number
    revenuePaidThisMonth: number
    outstandingTotal: number
    outstandingInvoices: number
    wipValue: number
    currency: string
  }
  operational: {
    billableHoursThisMonth: number
    loggedHoursThisMonth: number
    billableRatio: number
    activeProjects: number
    upcomingPrazos: number
  }
  risk: {
    atRiskProjects: Array<{
      id: string
      name: string
      code: string
      category: string
      healthStatus: 'YELLOW' | 'RED'
      endDate: string | null
    }>
    criticalPrazos: Array<{
      id: string
      title: string
      dueDate: string
      isUrgent: boolean
      type: string
      processo: { id: string; processoNumber: string; title: string }
    }>
    overduePrazos: number
    unreadAlerts: number
    recentAlerts: unknown[]
  }
  topWipClientes: Array<{
    clienteId: string
    clienteName: string
    hours: number
    value: number
  }>
}

interface UpcomingPrazo {
  id: string
  title: string
  dueDate: string
  isUrgent: boolean
  status: string
  processo: { id: string; processoNumber: string }
}

interface CalendarEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  type: string
}

interface GanttProject {
  id: string
  code: string
  name: string
  status: string
  healthStatus: 'GREEN' | 'YELLOW' | 'RED'
  startDate: string | null
  endDate: string | null
  _count?: { milestones: number }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Compacts centavos into K / M AKZ with 1 decimal, keeping the unit
 *  as a separate span so the hero can style it smaller. */
function fmtAkz(centavos: number): { v: string; u: string } {
  const akz = centavos / 100
  if (Math.abs(akz) >= 1_000_000) return { v: (akz / 1_000_000).toFixed(1), u: 'M AKZ' }
  if (Math.abs(akz) >= 1_000) return { v: (akz / 1_000).toFixed(1), u: 'k AKZ' }
  return { v: akz.toLocaleString('pt-AO'), u: 'AKZ' }
}

function monthName(d: Date): string {
  return d
    .toLocaleDateString('pt-PT', { month: 'long' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

/** Light sparkline — visual cue, not precise data. Uses the accent colour. */
function Spark({ color = 'var(--k2-text-dim)' }: { color?: string }) {
  const pts = '0,12 10,8 20,10 30,6 40,9 50,4 60,6'
  return (
    <svg width={60} height={18} fill="none" stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
      <polyline points={pts} />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession()
  const firstName = session?.user?.firstName ?? ''

  const { data: exec, loading } = useApi<ExecutiveDashboard>('/stats/executive')

  // 14-day window for the calendar grid
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])
  const windowEnd = useMemo(() => {
    const e = new Date(today)
    e.setDate(e.getDate() + 14)
    return e
  }, [today])

  const { data: upcomingPrazos } = useApi<{ upcoming?: UpcomingPrazo[]; overdue?: UpcomingPrazo[] }>(
    `/prazos/upcoming`,
  )
  const { data: calendarEvents } = useApi<CalendarEvent[]>(
    `/calendar/events?startDate=${today.toISOString()}&endDate=${windowEnd.toISOString()}`,
  )
  const { data: projectsData } = useApi<{ data: GanttProject[] }>(
    `/projects?status=ACTIVO&limit=8`,
  )

  const projects = projectsData?.data ?? []
  const prazosAll = [
    ...(upcomingPrazos?.upcoming ?? []),
    ...(upcomingPrazos?.overdue ?? []),
  ]

  const billedThisMonth = fmtAkz(exec?.financial.revenueBilledThisMonth ?? 0)
  const outstanding = fmtAkz(exec?.financial.outstandingTotal ?? 0)
  const wip = fmtAkz(exec?.financial.wipValue ?? 0)

  const upcomingCount = exec?.operational.upcomingPrazos ?? 0
  const billableHours = exec?.operational.billableHoursThisMonth ?? 0
  // Rough monthly target for the capacity ring: 23.5h billable × 4 weeks = 94h
  const billableTarget = 94
  const capacityPct = Math.min(1, billableHours / billableTarget)

  return (
    <>
      <style jsx global>{`
        .k2-dash {
          background: var(--k2-bg);
          color: var(--k2-text);
          min-height: 100%;
          margin: -1rem -1.5rem -1.5rem; /* cancel dashboard-layout padding so hero spans edge-to-edge */
          font-feature-settings: 'tnum', 'zero';
          min-width: 0;
          max-width: 100%;
          overflow-x: clip;
        }
        .k2-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
          gap: 24px;
          padding: 36px clamp(20px, 3vw, 40px) 28px;
          align-items: end;
          margin-bottom: 8px;
          min-width: 0;
        }
        .k2-hero-date {
          font-size: 12px;
          color: var(--k2-text-mute);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .k2-hero-date::before {
          content: '';
          width: 24px;
          height: 1px;
          background: var(--k2-text-mute);
        }
        .k2-hero-title {
          font-size: 44px;
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1.02;
          margin: 0;
          color: var(--k2-text);
        }
        .k2-hero-title em {
          font-style: normal;
          color: var(--k2-accent);
        }
        .k2-hero-sub {
          margin: 14px 0 0;
          color: var(--k2-text-dim);
          font-size: 14px;
          max-width: 460px;
          line-height: 1.5;
        }
        .k2-hero-illu {
          position: relative;
          height: 180px;
        }
        .k2-hero-illu svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .k2-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          padding: 0 clamp(20px, 3vw, 40px);
          margin-bottom: 40px;
          min-width: 0;
        }
        .k2-stat {
          padding: 20px 24px 20px 0;
          position: relative;
        }
        .k2-stat + .k2-stat {
          padding-left: 32px;
        }
        .k2-stat + .k2-stat::before {
          content: '';
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 1px;
          background: var(--k2-border);
        }
        .k2-stat-label {
          font-size: 10px;
          color: var(--k2-text-mute);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .k2-stat-num {
          font-size: 38px;
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1;
          display: flex;
          align-items: baseline;
          gap: 6px;
          color: var(--k2-text);
          font-variant-numeric: tabular-nums;
        }
        .k2-stat-num .u {
          font-size: 14px;
          color: var(--k2-text-dim);
          font-weight: 400;
          letter-spacing: 0;
        }
        .k2-stat-trend {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--k2-text-dim);
        }

        .k2-dash-main {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          gap: clamp(20px, 2.5vw, 40px);
          padding: 0 clamp(20px, 3vw, 40px) 48px;
          align-items: start;
          min-width: 0;
        }
        .k2-section-label {
          font-size: 10px;
          color: var(--k2-text-mute);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .k2-section-label .num {
          color: var(--k2-text-dim);
          font-variant-numeric: tabular-nums;
        }
        .k2-section-label .line {
          flex: 1;
          height: 1px;
          background: var(--k2-border);
        }

        .k2-cap {
          padding: 8px 0 32px;
          display: flex;
          align-items: center;
          gap: 36px;
        }
        .k2-cap-body .big {
          font-size: 52px;
          font-weight: 500;
          letter-spacing: -0.04em;
          line-height: 1;
          color: var(--k2-text);
          font-variant-numeric: tabular-nums;
        }
        .k2-cap-body .big .u {
          font-size: 18px;
          color: var(--k2-text-dim);
          margin-left: 4px;
        }
        .k2-cap-body .desc {
          color: var(--k2-text-dim);
          font-size: 13px;
          margin-top: 10px;
          max-width: 280px;
          line-height: 1.5;
        }
        .k2-cap-body .desc strong {
          color: var(--k2-text);
          font-weight: 500;
        }

        .k2-cal-head {
          display: grid;
          grid-template-columns: repeat(14, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 10px;
        }
        .k2-cal-dow {
          text-align: center;
          font-size: 10px;
          color: var(--k2-text-mute);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .k2-cal-grid {
          display: grid;
          grid-template-columns: repeat(14, minmax(0, 1fr));
          gap: 6px;
        }
        .k2-cal-cell {
          position: relative;
          aspect-ratio: 1;
          background: var(--k2-bg-elev);
          border-radius: 6px;
          padding: 6px 7px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: default;
          transition: background 150ms, transform 150ms;
        }
        .k2-cal-cell:hover {
          background: var(--k2-bg-elev-2);
          transform: translateY(-1px);
        }
        .k2-cal-cell.today {
          background: var(--k2-text);
          color: var(--k2-bg);
        }
        .k2-cal-cell.weekend {
          opacity: 0.5;
        }
        .k2-cal-day {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .k2-cal-month {
          font-size: 9px;
          color: var(--k2-text-mute);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: -2px;
        }
        .k2-cal-cell.today .k2-cal-month {
          color: var(--k2-bg);
          opacity: 0.6;
        }
        .k2-cal-events {
          display: flex;
          gap: 2px;
          align-items: center;
          flex-wrap: wrap;
        }
        .k2-cal-ev {
          height: 3px;
          border-radius: 2px;
          flex: 1;
          min-width: 6px;
        }
        .k2-cal-ev.bad {
          background: var(--k2-text);
        }
        .k2-cal-ev.warn {
          background: var(--k2-text-dim);
        }
        .k2-cal-ev.ok {
          background: var(--k2-text-mute);
        }
        .k2-cal-cell.today .k2-cal-ev.bad {
          background: var(--k2-bg);
        }
        .k2-cal-cell.today .k2-cal-ev.warn {
          background: var(--k2-bg);
          opacity: 0.6;
        }
        .k2-cal-cell.today .k2-cal-ev.ok {
          background: var(--k2-bg);
          opacity: 0.35;
        }
        .k2-cal-count {
          position: absolute;
          top: 4px;
          right: 6px;
          font-size: 9px;
          color: var(--k2-text-mute);
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }
        .k2-cal-cell.today .k2-cal-count {
          color: var(--k2-bg);
          opacity: 0.7;
        }
        .k2-cal-legend {
          display: flex;
          gap: 16px;
          margin-top: 18px;
          font-size: 11px;
          color: var(--k2-text-dim);
        }
        .k2-cal-legend-dot {
          display: inline-block;
          width: 8px;
          height: 3px;
          border-radius: 2px;
          margin-right: 6px;
          vertical-align: middle;
        }

        .k2-gantt {
          display: flex;
          flex-direction: column;
        }
        .k2-gantt-head {
          display: grid;
          grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
          align-items: end;
          padding: 0 0 10px;
          font-size: 10px;
          color: var(--k2-text-mute);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .k2-gantt-row {
          display: grid;
          grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
          align-items: center;
          padding: 18px 0;
          position: relative;
          background: linear-gradient(to right, var(--k2-border), var(--k2-border));
          background-size: 100% 1px;
          background-repeat: no-repeat;
          background-position: top;
        }
        .k2-gantt-row:first-of-type {
          background: none;
        }
        .k2-gantt-label {
          display: flex;
          gap: 14px;
          align-items: center;
          padding-right: 20px;
        }
        .k2-gantt-num {
          font-size: 22px;
          font-weight: 400;
          color: var(--k2-text-mute);
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
          width: 32px;
          flex-shrink: 0;
        }
        .k2-gantt-title {
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin-bottom: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--k2-text);
        }
        .k2-gantt-phase {
          font-size: 11px;
          color: var(--k2-text-mute);
          letter-spacing: 0.04em;
        }
        .k2-gantt-phase .dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }
        .k2-gantt-phase .dot.warn { background: var(--k2-text-dim); }
        .k2-gantt-phase .dot.bad { background: var(--k2-text); }
        .k2-gantt-phase .dot.ok { background: var(--k2-text-mute); }
        .k2-gantt-track {
          position: relative;
          height: 28px;
        }
        .k2-gantt-track::before {
          content: '';
          position: absolute;
          top: 50%;
          height: 1px;
          background: repeating-linear-gradient(
            to right,
            var(--k2-border) 0,
            var(--k2-border) 3px,
            transparent 3px,
            transparent 6px
          );
          left: 0;
          right: 0;
        }
        .k2-gantt-bar {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          height: 10px;
          border-radius: 5px;
          overflow: hidden;
          transition: height 200ms;
        }
        .k2-gantt-bar:hover { height: 14px; }
        .k2-gantt-bar.warn { background: var(--k2-text-dim); }
        .k2-gantt-bar.bad { background: var(--k2-text); }
        .k2-gantt-bar.ok { background: var(--k2-text-mute); }
        .k2-gantt-now {
          position: absolute;
          top: -8px;
          bottom: -8px;
          width: 1px;
          background: var(--k2-text);
        }
        .k2-gantt-now::before {
          content: 'Hoje';
          position: absolute;
          top: -6px;
          left: -18px;
          font-size: 9px;
          color: var(--k2-text);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: var(--k2-bg);
          padding: 0 4px;
        }

        .k2-qa {
          display: flex;
          flex-direction: column;
          margin-top: 20px;
        }
        .k2-qa-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 0;
          color: var(--k2-text-dim);
          font-size: 13px;
          cursor: pointer;
          transition: color 150ms, padding 200ms;
          background: linear-gradient(to right, var(--k2-border), var(--k2-border));
          background-size: 100% 1px;
          background-repeat: no-repeat;
          background-position: top;
        }
        .k2-qa-item:first-of-type { background: none; }
        .k2-qa-item:hover {
          color: var(--k2-text);
          padding-left: 6px;
        }
        .k2-qa-item .qa-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          color: var(--k2-text-mute);
          flex-shrink: 0;
        }
        .k2-qa-item:hover .qa-icon { color: var(--k2-accent); }
        .k2-qa-item .qa-label { flex: 1; }
        .k2-qa-item .qa-arrow { color: var(--k2-text-mute); transition: transform 200ms; }
        .k2-qa-item:hover .qa-arrow { transform: translateX(4px); color: var(--k2-accent); }

        /* Stats go 4 → 2 cols on mid viewports so text doesn't stretch */
        @media (max-width: 1400px) {
          .k2-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .k2-stat + .k2-stat::before { display: none; }
        }
        /* Main 2-col collapses at laptop widths */
        @media (max-width: 1200px) {
          .k2-dash-main {
            grid-template-columns: minmax(0, 1fr);
            gap: 32px;
          }
        }
        /* Hero + stats collapse on tablet */
        @media (max-width: 900px) {
          .k2-hero {
            grid-template-columns: minmax(0, 1fr);
            padding: 24px 20px;
          }
          .k2-hero-illu { display: none; }   /* illustration gracefully drops on small screens */
          .k2-strip {
            grid-template-columns: minmax(0, 1fr);
            padding: 0 20px;
          }
          .k2-dash-main { padding: 0 20px 32px; }
          .k2-hero-title { font-size: 32px; }
        }
        /* Extra small — ensure gantt label column doesn't crowd out the bar */
        @media (max-width: 640px) {
          .k2-gantt-head,
          .k2-gantt-row {
            grid-template-columns: minmax(0, 1fr);
          }
          .k2-hero-title { font-size: 26px; }
        }
      `}</style>

      <div className="k2-dash">
        {/* HERO */}
        <HeroBand
          firstName={firstName}
          upcomingCount={upcomingCount}
          outstandingCentavos={exec?.financial.outstandingTotal ?? 0}
          outstandingInvoices={exec?.financial.outstandingInvoices ?? 0}
        />

        {/* STATS STRIP */}
        <div className="k2-strip">
          <StatBlock
            label={`Facturado · ${monthName(new Date())}`}
            valueHead={billedThisMonth.v}
            unit={billedThisMonth.u}
            trend={`${Math.round((exec?.financial.revenuePaidThisMonth ?? 0) / 100).toLocaleString('pt-AO')} recebidos`}
            sparkColor="var(--k2-accent)"
            loading={loading}
          />
          <StatBlock
            label="Em dívida"
            valueHead={outstanding.v}
            unit={outstanding.u}
            trend={`${exec?.financial.outstandingInvoices ?? 0} factura(s) pendentes`}
            sparkColor="var(--k2-bad)"
            loading={loading}
          />
          <StatBlock
            label="WIP por facturar"
            valueHead={wip.v}
            unit={wip.u}
            trend={`${billableHours.toFixed(1)}h facturáveis este mês`}
            sparkColor="var(--k2-good)"
            loading={loading}
          />
          <StatBlock
            label="Projectos activos"
            valueHead={String(exec?.operational.activeProjects ?? 0)}
            unit=""
            trend={
              (exec?.risk.atRiskProjects.length ?? 0) > 0
                ? `${exec!.risk.atRiskProjects.length} em atenção`
                : 'todos saudáveis'
            }
            loading={loading}
          />
        </div>

        {/* MAIN 2-COL */}
        <div className="k2-dash-main">
          {/* LEFT — capacity + calendar */}
          <div>
            <div className="k2-section-label">
              <span>Capacidade · esta semana</span>
              <span className="line" />
            </div>
            <CapacityViz
              billableHours={billableHours}
              target={billableTarget}
              pct={capacityPct}
            />

            <div className="k2-section-label">
              <span>Próximos 14 dias</span>
              <span className="num">
                {prazosAll.length + (calendarEvents?.length ?? 0)} eventos
              </span>
              <span className="line" />
            </div>
            <DeadlineTimeline
              today={today}
              prazos={prazosAll}
              events={calendarEvents ?? []}
            />
          </div>

          {/* RIGHT — gantt + quick actions */}
          <div>
            <div className="k2-section-label">
              <span>Projectos activos</span>
              <span className="num">
                {(exec?.operational.activeProjects ?? 0)
                  .toString()
                  .padStart(2, '0')}
              </span>
              <span className="line" />
            </div>
            <ProjectsGantt projects={projects} />

            <div className="k2-section-label" style={{ marginTop: 40 }}>
              <span>Acções rápidas</span>
              <span className="line" />
            </div>
            <QuickActions />
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function HeroBand({
  firstName,
  upcomingCount,
  outstandingCentavos,
  outstandingInvoices,
}: {
  firstName: string
  upcomingCount: number
  outstandingCentavos: number
  outstandingInvoices: number
}) {
  const today = new Date()
    .toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    .replace(/^\w/, (c) => c.toUpperCase())

  // Build headline dynamically from real signals
  let highlight = 'Tudo em ordem'
  let sub = 'Sem prazos críticos nem facturas por liquidar.'
  if (upcomingCount > 0) {
    const plural = upcomingCount === 1 ? 'prazo' : 'prazos'
    highlight = `${upcomingCount} ${plural}`
    sub = `${upcomingCount} ${plural} na próxima semana.`
  }
  if (outstandingCentavos > 0) {
    const { v, u } = fmtAkz(outstandingCentavos)
    sub = `${v}${u.startsWith('M') || u.startsWith('k') ? u : ' ' + u} em dívida · ${outstandingInvoices} factura(s) por liquidar.`
  }

  return (
    <div className="k2-hero">
      <div>
        <div className="k2-hero-date">
          <span style={{ textTransform: 'capitalize' }}>{today}</span>
        </div>
        <h1 className="k2-hero-title">
          {greeting()}, {firstName || '—'}.<br />
          <em>{highlight}</em> esta semana.
        </h1>
        <p className="k2-hero-sub">{sub}</p>
      </div>
      <div className="k2-hero-illu" aria-hidden="true">
        <svg viewBox="0 0 320 180" fill="none">
          <g stroke="var(--k2-border-strong)" strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 40 L50 160 L160 160 L160 55 L145 40 Z" />
            <path d="M145 40 L145 55 L160 55" />
            <path d="M70 70 H130 M70 82 H135 M70 94 H120 M70 106 H135 M70 118 H125" opacity="0.5" />
          </g>
          <g stroke="var(--k2-border-strong)" strokeLinecap="round" strokeLinejoin="round" transform="translate(110 10) rotate(6)">
            <path d="M50 40 L50 160 L160 160 L160 55 L145 40 Z" fill="var(--k2-bg)" />
            <path d="M145 40 L145 55 L160 55" />
            <path d="M70 70 H130 M70 82 H135 M70 94 H120 M70 106 H135" opacity="0.5" />
          </g>
          <g stroke="var(--k2-accent)" strokeLinecap="round" strokeLinejoin="round" transform="translate(120 -8) rotate(12)">
            <path d="M50 40 L50 160 L160 160 L160 55 L145 40 Z" fill="var(--k2-bg)" />
            <path d="M145 40 L145 55 L160 55" />
            <path d="M70 70 H130 M70 82 H135 M70 94 H120" opacity="0.7" />
            <circle cx="140" cy="135" r="14" fill="var(--k2-accent)" stroke="none" opacity="0.15" />
            <path d="M134 135 L138 139 L146 131" stroke="var(--k2-accent)" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    </div>
  )
}

function StatBlock({
  label,
  valueHead,
  unit,
  trend,
  sparkColor,
  loading,
}: {
  label: string
  valueHead: string
  unit: string
  trend: string
  sparkColor?: string
  loading?: boolean
}) {
  return (
    <div className="k2-stat">
      <div className="k2-stat-label">{label}</div>
      <div className="k2-stat-num">
        {loading ? (
          <span className="inline-block h-[38px] w-20 animate-pulse bg-[var(--k2-bg-elev-2)] rounded" />
        ) : (
          <>
            {valueHead}
            {unit && <span className="u">{unit}</span>}
          </>
        )}
      </div>
      <div className="k2-stat-trend">
        <Spark color={sparkColor} />
        <span>{trend}</span>
      </div>
    </div>
  )
}

function CapacityViz({
  billableHours,
  target,
  pct,
}: {
  billableHours: number
  target: number
  pct: number
}) {
  const size = 180
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="k2-cap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--k2-border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--k2-accent)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2
          const r1 = r + stroke / 2 + 4
          const r2 = r + stroke / 2 + 8
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * r1}
              y1={size / 2 + Math.sin(a) * r1}
              x2={size / 2 + Math.cos(a) * r2}
              y2={size / 2 + Math.sin(a) * r2}
              stroke="var(--k2-text-mute)"
              strokeWidth="1"
              opacity="0.4"
            />
          )
        })}
      </svg>
      <div className="k2-cap-body">
        <div className="big">
          {billableHours.toFixed(1)}
          <span className="u">/ {target}h</span>
        </div>
        <div className="desc">
          <strong>{Math.round(pct * 100)}%</strong> das horas facturáveis consumidas neste mês.
          {pct >= 0.85 && ' Ritmo forte — cuidado com sobrecarga.'}
          {pct < 0.4 && ' Margem para aumentar actividade facturável.'}
        </div>
      </div>
    </div>
  )
}

function DeadlineTimeline({
  today,
  prazos,
  events,
}: {
  today: Date
  prazos: UpcomingPrazo[]
  events: CalendarEvent[]
}) {
  const cells = useMemo(() => {
    // Bucket prazos + events by day offset from today
    const dayBuckets: Array<{ bad: number; warn: number; ok: number }> = Array.from(
      { length: 14 },
      () => ({ bad: 0, warn: 0, ok: 0 }),
    )

    const put = (iso: string, tone: 'bad' | 'warn' | 'ok') => {
      const d = new Date(iso)
      d.setHours(0, 0, 0, 0)
      const diff = Math.floor((d.getTime() - today.getTime()) / 86_400_000)
      if (diff < 0 || diff >= 14) return
      dayBuckets[diff][tone]++
    }

    prazos.forEach((p) => {
      const tone = p.isUrgent
        ? 'bad'
        : new Date(p.dueDate) < today
          ? 'bad'
          : 'warn'
      put(p.dueDate, tone)
    })
    events.forEach((e) => {
      put(e.startAt, 'ok')
    })

    const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const b = dayBuckets[i]
      return {
        date: d,
        dow: DOW[d.getDay()],
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        buckets: b,
        total: b.bad + b.warn + b.ok,
        offset: i,
      }
    })
  }, [today, prazos, events])

  return (
    <div>
      <div className="k2-cal-head">
        {cells.map((c, i) => (
          <div key={i} className="k2-cal-dow">
            {c.dow}
          </div>
        ))}
      </div>
      <div className="k2-cal-grid">
        {cells.map((c, i) => {
          const classes = ['k2-cal-cell']
          if (i === 0) classes.push('today')
          else if (c.isWeekend) classes.push('weekend')
          return (
            <div key={i} className={classes.join(' ')} title={`${c.total} evento(s)`}>
              <div>
                <div className="k2-cal-day">{c.date.getDate()}</div>
                <div className="k2-cal-month">
                  {c.date
                    .toLocaleDateString('pt-PT', { month: 'short' })
                    .replace('.', '')}
                </div>
              </div>
              {c.total > 0 && <div className="k2-cal-count">{c.total}</div>}
              <div className="k2-cal-events">
                {Array.from({ length: c.buckets.bad }).map((_, j) => (
                  <div key={`b${j}`} className="k2-cal-ev bad" />
                ))}
                {Array.from({ length: c.buckets.warn }).map((_, j) => (
                  <div key={`w${j}`} className="k2-cal-ev warn" />
                ))}
                {Array.from({ length: c.buckets.ok }).map((_, j) => (
                  <div key={`o${j}`} className="k2-cal-ev ok" />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="k2-cal-legend">
        <span>
          <span className="k2-cal-legend-dot" style={{ background: 'var(--k2-text)' }} />
          Urgente
        </span>
        <span>
          <span
            className="k2-cal-legend-dot"
            style={{ background: 'var(--k2-text-dim)' }}
          />
          Prazo
        </span>
        <span>
          <span
            className="k2-cal-legend-dot"
            style={{ background: 'var(--k2-text-mute)' }}
          />
          Agenda
        </span>
      </div>
    </div>
  )
}

function ProjectsGantt({ projects }: { projects: GanttProject[] }) {
  // Compute a shared timeline: min(startDate) → max(endDate)
  const today = Date.now()
  const spans = useMemo(() => {
    if (projects.length === 0) return null
    const starts = projects
      .map((p) => (p.startDate ? new Date(p.startDate).getTime() : null))
      .filter((x): x is number => x !== null)
    const ends = projects
      .map((p) => (p.endDate ? new Date(p.endDate).getTime() : null))
      .filter((x): x is number => x !== null)
    if (!starts.length || !ends.length) return null
    const min = Math.min(...starts, today - 30 * 86_400_000)
    const max = Math.max(...ends, today + 30 * 86_400_000)
    return { min, max, range: max - min }
  }, [projects, today])

  if (!spans || projects.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--k2-text-dim)',
          fontSize: 13,
        }}
      >
        Sem projectos activos com datas definidas.
      </div>
    )
  }

  const toneFor = (h: 'GREEN' | 'YELLOW' | 'RED'): 'ok' | 'warn' | 'bad' =>
    h === 'RED' ? 'bad' : h === 'YELLOW' ? 'warn' : 'ok'

  const nowPct = ((today - spans.min) / spans.range) * 100

  return (
    <div className="k2-gantt">
      <div className="k2-gantt-head">
        <div>
          {projects.length} projectos · {projects.filter((p) => p.healthStatus !== 'GREEN').length}{' '}
          em atenção
        </div>
        <div style={{ fontSize: 10 }}>
          {new Date(spans.min).toLocaleDateString('pt-PT', {
            month: 'short',
          })}{' '}
          →{' '}
          {new Date(spans.max).toLocaleDateString('pt-PT', {
            month: 'short',
          })}
        </div>
      </div>
      {projects.slice(0, 6).map((p, i) => {
        const start = p.startDate ? new Date(p.startDate).getTime() : spans.min
        const end = p.endDate ? new Date(p.endDate).getTime() : spans.max
        const leftPct = ((start - spans.min) / spans.range) * 100
        const widthPct = ((end - start) / spans.range) * 100
        const tone = toneFor(p.healthStatus)
        return (
          <Link
            key={p.id}
            href={`/projectos/${p.id}`}
            className="k2-gantt-row"
            style={{ textDecoration: 'none' }}
          >
            <div className="k2-gantt-label">
              <div className="k2-gantt-num">{String(i + 1).padStart(2, '0')}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="k2-gantt-title">{p.name}</div>
                <div className="k2-gantt-phase">
                  <span className={`dot ${tone}`} />
                  {p.code}
                </div>
              </div>
            </div>
            <div className="k2-gantt-track">
              <div
                className={`k2-gantt-bar ${tone}`}
                style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
              />
              {nowPct >= 0 && nowPct <= 100 && (
                <div className="k2-gantt-now" style={{ left: `${nowPct}%` }} />
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function QuickActions() {
  const items: Array<{ href: string; icon: React.ReactNode; label: string; hint: string }> = [
    {
      href: '/facturas/nova',
      label: 'Emitir factura',
      hint: 'Agregar timesheets',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 7h6M9 11h6M9 15h4" />
        </svg>
      ),
    },
    {
      href: '/projectos/novo',
      label: 'Novo projecto',
      hint: 'M&A, Compliance…',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    },
    {
      href: '/prazos/novo',
      label: 'Registar prazo',
      hint: 'Dias úteis automáticos',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={12} cy={12} r={9} />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      href: '/ia-assistente',
      label: 'IA Assistente',
      hint: 'Redigir peça',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        </svg>
      ),
    },
  ]
  return (
    <div className="k2-qa">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="k2-qa-item"
          style={{ textDecoration: 'none' }}
        >
          <span className="qa-icon">{it.icon}</span>
          <span className="qa-label">{it.label}</span>
          <span className="qa-hint">{it.hint}</span>
          <span className="qa-arrow">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  )
}
