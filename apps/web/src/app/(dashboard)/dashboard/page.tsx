'use client'

/**
 * Kamaia CLM — Executive Overview.
 *
 * Redesign baseado no design system "Monolith Enterprise" (Stitch):
 *  - Paleta: branco puro + escala de azul-tinted grays + #0066FF accent
 *  - Tipografia: Geist (label uppercase tracked, números tabular)
 *  - Layout: card-based com 1px borders (sem shadows pesadas)
 *  - Tom: "Quiet Confidence" — espaços generosos, hierarquia clara
 *
 * Tokens estão scoped via inline styles para não afectar o resto
 * da app (rollout incremental — depois extraímos para CSS global
 * se gostarmos).
 */

import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import {
  ContratoEstado,
  CONTRATO_ESTADO_LABELS,
} from '@kamaia/shared-types'
import {
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { estadoBadgeVariant } from '@/lib/clm-format'

interface DashboardData {
  total: number
  activos: number
  porEstado: Partial<Record<ContratoEstado, number>>
  expiraEm30: number
  expiraEm30RiscoCentavos: string
  expiraEm90: number
  denunciaEm60: number
  actosPendentes: number
  tendencia: {
    criadosTrimestre: number
    criadosTrimestreAnterior: number
    deltaPercent: number
  }
  serie6m: { mes: string; mesIso: string; count: number }[]
  recentes: Array<{
    id: string
    numeroInterno: string | null
    titulo: string
    estado: ContratoEstado
    updatedAt: string
    responsavelNome: string | null
  }>
}

/**
 * Tokens via CSS variables globais — desde o roll-out do design
 * Monolith Enterprise, `--k2-*` já tem os valores correctos (cores
 * azul-tinted + ink #0b1c30 + accent #0066ff). Não precisamos de
 * overrides locais; mantemos o objecto `T` apenas para referência
 * semântica dentro do componente.
 */
const T = {
  surface: 'var(--k2-bg-elev)',
  surfaceMuted: 'var(--k2-bg)',
  borderSoft: 'var(--k2-border)',
  borderHard: 'var(--k2-border-strong)',
  ink: 'var(--k2-text)',
  inkDim: 'var(--k2-text-dim)',
  inkMute: 'var(--k2-text-mute)',
  primary: 'var(--k2-accent)',
  primaryDark: 'var(--k2-accent-dim)',
  primaryFg: 'var(--k2-accent-fg)',
  good: 'var(--k2-good)',
  warn: 'var(--k2-warn)',
  bad: 'var(--k2-bad)',
}

type Range = '6M' | '1Y' | 'ALL'

export default function ExecutiveOverviewPage() {
  const { data, loading, error } = useApi<DashboardData>('/contratos/dashboard')
  const [range, setRange] = useState<Range>('6M')

  return (
    <div
      style={{
        background: T.surfaceMuted,
        margin: '-1.25rem -1.5rem -2rem',
        padding: '1.25rem 1.75rem 2rem',
        minHeight: 'calc(100vh - var(--k2-topbar-h, 60px))',
        color: T.ink,
        fontFamily: 'Geist, -apple-system, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Header />

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: 'var(--k2-bg-elev)',
              color: T.bad,
              border: `1px solid ${T.bad}`,
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* AUDIT P0 #1: grid colapsa a 1 coluna em < 900px para evitar
            colisão chart×metrics em mobile. */}
        <div className="k2-dash-grid" style={{ marginTop: 20 }}>
          <ChartCard data={data} loading={loading} range={range} onRange={setRange} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <MetricCard
              label="Contratos activos"
              value={data?.activos ?? 0}
              delta={data?.tendencia.deltaPercent ?? 0}
              deltaLabel="este trimestre"
              loading={loading}
              href="/contratos?estado=ACTIVO"
            />
            <MetricCard
              label="Expiram em 30 dias"
              value={data?.expiraEm30 ?? 0}
              riscoCentavos={data?.expiraEm30RiscoCentavos}
              loading={loading}
              href="/contratos?expiraEmDias=30"
            />
          </div>
        </div>

        <DistribuicaoEstado data={data} loading={loading} />

        <RecentActivity data={data} loading={loading} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Header — title + secondary actions
// ─────────────────────────────────────

function Header() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            color: T.ink,
          }}
        >
          Visão Executiva
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          href="/contratos/novo"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: T.ink,
            color: 'var(--k2-accent-fg)',
            // AUDIT: shapes filled não levam border (rule).
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <Plus size={14} />
          Novo contrato
        </Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Chart card — Contract Trends
// ─────────────────────────────────────

function ChartCard({
  data,
  loading,
  range,
  onRange,
}: {
  data?: DashboardData | null
  loading: boolean
  range: Range
  onRange: (r: Range) => void
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: '-0.01em',
            }}
          >
            Tendência de contratos
          </div>
          <div style={{ fontSize: 12, color: T.inkDim, marginTop: 2 }}>
            Volume de actividade nos últimos 6 meses
          </div>
        </div>
        <RangeToggle value={range} onChange={onRange} />
      </div>

      {loading ? (
        <div
          style={{
            height: 220,
            display: 'grid',
            placeItems: 'center',
            color: T.inkMute,
            fontSize: 13,
          }}
        >
          A carregar…
        </div>
      ) : (
        <Sparkline series={data?.serie6m ?? []} />
      )}
    </div>
  )
}

function RangeToggle({
  value,
  onChange,
}: {
  value: Range
  onChange: (r: Range) => void
}) {
  const opts: Range[] = ['6M', '1Y', 'ALL']
  return (
    <div
      style={{
        display: 'inline-flex',
        background: T.surfaceMuted,
        border: `1px solid ${T.borderSoft}`,
        borderRadius: 6,
        padding: 2,
        gap: 2,
      }}
    >
      {opts.map((o) => {
        const active = value === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              padding: '4px 12px',
              background: active ? T.ink : 'transparent',
              color: active ? T.surface : T.inkDim,
              border: 'none',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {o === 'ALL' ? 'All' : o}
          </button>
        )
      })}
    </div>
  )
}

function Sparkline({ series }: { series: { mes: string; count: number }[] }) {
  const data = series.length > 0 ? series : Array.from({ length: 6 }, () => ({ mes: '', count: 0 }))
  const max = Math.max(...data.map((d) => d.count), 1)
  const W = 100
  const H = 60
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * W
    const y = H - (d.count / max) * H * 0.85 - H * 0.075
    return { x, y, label: d.mes, count: d.count }
  })
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  // Area under curve
  const area = `${path} L ${W} ${H} L 0 ${H} Z`

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 200, display: 'block' }}
      >
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.ink} stopOpacity="0.08" />
            <stop offset="100%" stopColor={T.ink} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkfill)" />
        <path
          d={path}
          fill="none"
          stroke={T.ink}
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="0.8"
            fill={T.surface}
            stroke={T.ink}
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {/* AUDIT P2 #9: gap garante separação visual em mobile,
          onde antes os labels colavam ("JanFevMarAbrMaiJun"). */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${data.length}, 1fr)`,
          gap: 4,
          marginTop: 6,
          fontSize: 11,
          color: T.inkDim,
        }}
      >
        {data.map((d, i) => (
          <span
            key={i}
            style={{
              textAlign: 'center',
              textTransform: 'capitalize',
            }}
          >
            {d.mes}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Metric card
// ─────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  riscoCentavos,
  loading,
  href,
}: {
  label: string
  value: number
  delta?: number
  deltaLabel?: string
  riscoCentavos?: string
  loading?: boolean
  href: string
}) {
  const showDelta = delta !== undefined && delta !== 0
  const positive = (delta ?? 0) >= 0
  const valor = useMemo(
    () => (riscoCentavos ? formatRisco(riscoCentavos) : null),
    [riscoCentavos],
  )

  return (
    <Link
      href={href}
      style={{
        ...cardStyle,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        textDecoration: 'none',
        color: T.ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={labelStyle}>{label.toUpperCase()}</div>
      </div>

      <div
        style={{
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
          color: T.ink,
        }}
      >
        {loading ? '—' : value.toLocaleString('pt-PT')}
      </div>

      {showDelta && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: positive ? T.good : T.bad,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {positive ? (
            <ArrowUpRight size={13} />
          ) : (
            <ArrowDownRight size={13} />
          )}
          {positive ? '+' : ''}
          {delta}% {deltaLabel}
        </div>
      )}

      {valor && (
        <div
          style={{
            fontSize: 12,
            color: T.warn,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ⚠ Risco estimado: {valor}
        </div>
      )}
    </Link>
  )
}

function formatRisco(centavosStr: string): string {
  try {
    const c = BigInt(centavosStr)
    const akz = Number(c / BigInt(100))
    if (akz >= 1_000_000) {
      return `AKZ ${(akz / 1_000_000).toFixed(1)}M`
    }
    if (akz >= 1_000) {
      return `AKZ ${(akz / 1_000).toFixed(0)}K`
    }
    return `AKZ ${akz.toLocaleString('pt-PT')}`
  } catch {
    return '—'
  }
}

// ─────────────────────────────────────
// Recent Activity table
// ─────────────────────────────────────

function RecentActivity({
  data,
  loading,
}: {
  data?: DashboardData | null
  loading: boolean
}) {
  return (
    <div style={{ ...cardStyle, marginTop: 16, padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${T.borderSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: '-0.01em',
          }}
        >
          Actividade recente
        </div>
        <Link
          href="/contratos"
          style={{
            fontSize: 12,
            color: T.primary,
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Ver todos →
        </Link>
      </div>

      {/* AUDIT P0 #3: scroll horizontal em mobile para não cortar
          colunas. Em desktop a tabela ocupa 100% normalmente. */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <Th>Documento</Th>
            <Th>Estado</Th>
            <Th>Responsável</Th>
            <Th>Última edição</Th>
            <Th align="right">Acção</Th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5} style={tdEmpty}>
                A carregar…
              </td>
            </tr>
          )}
          {!loading && (!data?.recentes || data.recentes.length === 0) && (
            <tr>
              <td colSpan={5} style={tdEmpty}>
                Sem actividade recente.
              </td>
            </tr>
          )}
          {data?.recentes.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <Td>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: T.ink,
                  }}
                >
                  <FileText size={14} style={{ color: T.inkMute }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.titulo}</div>
                    {r.numeroInterno && (
                      <div
                        style={{
                          fontSize: 11,
                          color: T.inkMute,
                          marginTop: 2,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.numeroInterno}
                      </div>
                    )}
                  </div>
                </div>
              </Td>
              <Td>
                <StatusDot estado={r.estado} />
              </Td>
              <Td>
                <span style={{ color: T.ink }}>
                  {r.responsavelNome ?? '—'}
                </span>
              </Td>
              <Td>
                <span
                  style={{
                    color: T.inkDim,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatRelativeTime(r.updatedAt)}
                </span>
              </Td>
              <Td align="right">
                <Link
                  href={`/contratos/${r.id}`}
                  style={{
                    fontSize: 12,
                    color: T.primary,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Abrir →
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

function StatusDot({ estado }: { estado: ContratoEstado }) {
  const variant = estadoBadgeVariant(estado)
  const color =
    variant === 'success'
      ? T.good
      : variant === 'warning'
        ? T.warn
        : variant === 'danger'
          ? T.bad
          : T.inkDim
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: T.ink,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          display: 'inline-block',
        }}
      />
      {CONTRATO_ESTADO_LABELS[estado]}
    </span>
  )
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600_000)
  if (hours < 1) return 'há minutos'
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

// ─────────────────────────────────────
// Distribuição por estado
// ─────────────────────────────────────

function DistribuicaoEstado({
  data,
  loading,
}: {
  data?: DashboardData | null
  loading: boolean
}) {
  const estados = Object.values(ContratoEstado)
  const items = useMemo(
    () =>
      estados
        .map((e) => ({ estado: e, count: data?.porEstado?.[e] ?? 0 }))
        .filter((it) => it.count > 0)
        .sort((a, b) => b.count - a.count),
    [data, estados],
  )

  if (loading || items.length === 0) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>DISTRIBUIÇÃO POR ESTADO</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 8,
        }}
      >
        {items.map((it) => (
          <Link
            key={it.estado}
            href={`/contratos?estado=${it.estado}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: T.surface,
              border: `1px solid ${T.borderSoft}`,
              borderRadius: 6,
              textDecoration: 'none',
              color: T.ink,
              fontSize: 12,
            }}
          >
            <span style={{ color: T.inkDim }}>
              {CONTRATO_ESTADO_LABELS[it.estado]}
            </span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {it.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Styles partilhados ─────────────

const cardStyle: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.borderSoft}`,
  borderRadius: 8,
  padding: 20,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: T.inkDim,
}

const Th = ({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) => (
  <th
    style={{
      padding: '12px 20px',
      textAlign: align,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      color: T.inkMute,
      textTransform: 'uppercase',
      borderBottom: `1px solid ${T.borderSoft}`,
      background: T.surfaceMuted,
    }}
  >
    {children}
  </th>
)

const Td = ({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) => (
  <td
    style={{
      padding: '14px 20px',
      textAlign: align,
      verticalAlign: 'middle',
    }}
  >
    {children}
  </td>
)

const tdEmpty: React.CSSProperties = {
  padding: '24px 20px',
  textAlign: 'center',
  color: T.inkMute,
  fontSize: 13,
}
