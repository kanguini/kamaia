'use client'

/**
 * Facturas — slim list matching the rest of the dashboard lists.
 * KPIs on top (Facturado / Recebido / Em dívida) sit on pure bg with a
 * single border, no nested elev layer.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Filter, ArrowUpRight, ChevronDown,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'VOID'

interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string | null
  status: InvoiceStatus
  total: number
  amountPaid: number
  currency: string
  cliente: { id: string; name: string; nif: string | null }
  processo: { id: string; processoNumber: string; title: string } | null
  _count?: { items: number; payments: number }
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviada',
  PAID: 'Paga',
  PARTIALLY_PAID: 'Parcial',
  OVERDUE: 'Vencida',
  VOID: 'Anulada',
}

function fmtAkz(centavos: number): string {
  return `${(centavos / 100).toLocaleString('pt-AO')} AOA`
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '')
}

export default function FacturasPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        document.getElementById('fac-search')?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.append('status', statusFilter)
    return `/invoices?${params.toString()}`
  }, [statusFilter])

  const { data, loading, error } = useApi<{ data: Invoice[] }>(endpoint, [
    statusFilter,
  ])
  const invoices = data?.data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter((i) => {
      const blob = [i.number, i.cliente?.name, i.processo?.processoNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [invoices, search])

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  // KPIs — on the full (filter-wise) dataset, not just the page
  const totalBilled = invoices
    .filter((i) => i.status !== 'VOID' && i.status !== 'DRAFT')
    .reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0)
  const totalOutstanding = invoices
    .filter((i) => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
    .reduce((s, i) => s + (i.total - i.amountPaid), 0)

  return (
    <div className="px-page">
      <style jsx global>{facturasStyles}</style>

      <div className="px-head">
        <div className="px-title">Facturas</div>
        <div className="px-head-actions">
          <Link href="/facturas/nova" className="px-btn-primary">
            <Plus size={14} /> Nova factura
          </Link>
        </div>
      </div>

      {/* KPIs — single-layer cards, no bg-elev */}
      <div className="px-kpis">
        <KpiCard label="Facturado" value={fmtAkz(totalBilled)} />
        <KpiCard label="Recebido" value={fmtAkz(totalPaid)} tone="good" />
        <KpiCard
          label="Em dívida"
          value={fmtAkz(totalOutstanding)}
          tone={totalOutstanding > 0 ? 'bad' : undefined}
        />
      </div>

      <div className="px-toolbar">
        <div className="px-search">
          <Search size={14} />
          <input
            id="fac-search"
            placeholder="Pesquisar por nº, cliente, processo... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="px-search-clear" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>
        <FilterChip
          icon={<Filter size={13} />}
          label="Estado"
          value={statusFilter}
          options={(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((id) => ({
            id,
            label: STATUS_LABEL[id],
          }))}
          onChange={(v) => setStatusFilter(v)}
        />
      </div>

      {error && <div className="px-error">{error}</div>}

      <div className="px-table-wrap">
        <div className="px-table">
          <div className="px-thead">
            <div>Nº</div>
            <div>Cliente</div>
            <div>Vence</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div style={{ textAlign: 'right' }}>Estado</div>
          </div>
          {loading && invoices.length === 0 ? (
            <div className="px-empty">A carregar facturas…</div>
          ) : filtered.length === 0 ? (
            <div className="px-empty">
              Sem facturas. Agregue trabalho facturável numa{' '}
              <Link href="/facturas/nova" style={{ color: 'var(--k2-accent)' }}>
                nova factura
              </Link>
              .
            </div>
          ) : (
            visible.map((i) => {
              const isOverdue =
                i.dueDate &&
                new Date(i.dueDate) < new Date() &&
                !['PAID', 'VOID'].includes(i.status)
              const statusKey = i.status.toLowerCase().replace('_', '-')
              return (
                <div
                  key={i.id}
                  className="px-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/facturas/${i.id}`)}
                >
                  <div className="px-cell-name mono">{i.number}</div>
                  <div className="px-linked">
                    <span className="name">{i.cliente.name}</span>
                    {i.processo && (
                      <span className="muted mono">
                        {i.processo.processoNumber}
                      </span>
                    )}
                  </div>
                  <div className={`px-deadline ${isOverdue ? 'over' : ''}`}>
                    {fmtDate(i.dueDate)}
                  </div>
                  <div className="px-total mono">
                    {fmtAkz(i.total)}
                    <span className="sub">
                      Pago {fmtAkz(i.amountPaid)}
                    </span>
                  </div>
                  <div className="px-status" aria-label={`Estado: ${STATUS_LABEL[i.status]}`}>
                    <span className={`px-status-dot ${statusKey}`} />
                    <span
                      className={`px-status-label ${i.status === 'VOID' ? 'strike' : ''}`}
                    >
                      {STATUS_LABEL[i.status]}
                    </span>
                    <span className="px-status-arrow" aria-hidden="true">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="px-pagination">
          <span className="px-pagination-info">
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="px-pagination-nav">
            <button
              type="button"
              className="px-pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              ‹
            </button>
            <span className="px-pagination-page">
              {page} / {Math.ceil(filtered.length / PAGE_SIZE)}
            </span>
            <button
              type="button"
              className="px-pagination-btn"
              onClick={() =>
                setPage((p) => (p * PAGE_SIZE < filtered.length ? p + 1 : p))
              }
              disabled={page * PAGE_SIZE >= filtered.length}
              aria-label="Página seguinte"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="px-kpi">
      <div className="px-kpi-label">{label}</div>
      <div className={`px-kpi-value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

function FilterChip<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon?: React.ReactNode
  label: string
  value: T | null
  options: { id: T; label: string }[]
  onChange: (v: T | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = value != null
  const displayLabel = active
    ? options.find((o) => o.id === value)?.label ?? label
    : label

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`px-chip ${active ? 'on' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        <span>{displayLabel}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="px-popover">
          <button
            type="button"
            className={`px-popover-item ${value == null ? 'on' : ''}`}
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            <span className="px-check">{value == null ? '●' : ''}</span>
            Todos
          </button>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`px-popover-item ${value === o.id ? 'on' : ''}`}
              onClick={() => {
                onChange(o.id)
                setOpen(false)
              }}
            >
              <span className="px-check">{value === o.id ? '●' : ''}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const facturasStyles = `
.px-page {
  margin: -1rem -1.5rem -1.5rem;
  padding: 24px clamp(20px, 3vw, 40px) 48px;
  color: var(--k2-text);
  background: var(--k2-bg);
  min-width: 0; max-width: 100%; overflow-x: clip;
}
.px-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.px-title { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.px-head-actions { display: flex; align-items: center; gap: 8px; }
.px-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 13px; font-weight: 500; background: var(--k2-accent); color: var(--k2-accent-fg); border: none; border-radius: var(--k2-radius-sm); cursor: pointer; text-decoration: none; transition: filter 120ms; }
.px-btn-primary:hover { filter: brightness(1.08); }

.px-kpis {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px; margin-bottom: 16px;
}
.px-kpi {
  padding: 16px 18px; background: var(--k2-bg);
  border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius-lg);
}
.px-kpi-label {
  font-size: 10px; color: var(--k2-text-mute);
  letter-spacing: 0.1em; text-transform: uppercase;
  margin-bottom: 6px;
}
.px-kpi-value {
  font-size: 22px; font-weight: 500; letter-spacing: -0.02em;
  color: var(--k2-text);
  font-variant-numeric: tabular-nums;
}
.px-kpi-value.good { color: var(--k2-good); }
.px-kpi-value.bad  { color: var(--k2-bad); }

.px-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.px-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); color: var(--k2-text-mute); }
.px-search input { flex: 1; background: transparent; border: none; outline: none; color: var(--k2-text); font-size: 13px; font-family: inherit; }
.px-search input::placeholder { color: var(--k2-text-mute); }
.px-search-clear { background: transparent; border: none; color: var(--k2-text-mute); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }

.px-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 12px; font-weight: 500; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text-dim); cursor: pointer; transition: all 120ms; }
.px-chip:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-chip.on { color: var(--k2-text); border-color: var(--k2-accent); background: color-mix(in oklch, var(--k2-accent) 10%, var(--k2-bg)); }

.px-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 200px; padding: 6px; background: var(--k2-bg); border: 1px solid var(--k2-border-strong); border-radius: var(--k2-radius); box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5); }
.px-popover-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 10px; font-size: 13px; color: var(--k2-text-dim); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left; }
.px-popover-item:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
.px-popover-item.on { color: var(--k2-text); }
.px-check { width: 14px; display: inline-grid; place-items: center; font-size: 10px; color: var(--k2-accent); line-height: 1; }

.px-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid var(--k2-border); border-radius: var(--k2-radius-lg); background: var(--k2-bg); }
.px-table { min-width: 760px; }
.px-thead, .px-row {
  display: grid;
  grid-template-columns: 1fr 1.8fr 1fr 1.2fr 170px;
  gap: 16px; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid var(--k2-border);
}
.px-thead { background: transparent; font-size: 10px; color: var(--k2-text-mute); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.px-row { cursor: pointer; transition: background 120ms; }
.px-row:hover { background: var(--k2-bg-hover); }
.px-row:last-child { border-bottom: none; }

.px-cell-name.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px; color: var(--k2-text); font-weight: 500;
}
.px-linked { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.px-linked .name {
  font-size: 13px; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-linked .muted { font-size: 11px; color: var(--k2-text-mute); }
.px-linked .mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.px-deadline {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px; color: var(--k2-text-dim);
}
.px-deadline.over { color: var(--k2-bad); }

.px-total {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-end;
  font-size: 14px; color: var(--k2-text); font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.px-total .sub {
  font-size: 11px; color: var(--k2-text-mute); font-weight: 400;
}

.px-status { display: flex; align-items: center; justify-content: flex-end; gap: 8px; position: relative; }
.px-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
  box-shadow: 0 0 0 3px color-mix(in oklch, currentColor 15%, transparent);
}
.px-status-dot.draft            { background: var(--k2-text-mute); color: var(--k2-text-mute); }
.px-status-dot.sent             { background: var(--k2-accent); color: var(--k2-accent); }
.px-status-dot.paid             { background: var(--k2-good); color: var(--k2-good); }
.px-status-dot.partially-paid   { background: var(--k2-warn); color: var(--k2-warn); }
.px-status-dot.overdue          { background: var(--k2-bad); color: var(--k2-bad); }
.px-status-dot.void             { background: var(--k2-text-mute); color: var(--k2-text-mute); }

.px-status-label { font-size: 12px; color: var(--k2-text-dim); letter-spacing: -0.005em; white-space: nowrap; }
.px-status-label.strike { text-decoration: line-through; }
.px-status-arrow {
  display: inline-flex; align-items: center;
  color: var(--k2-text-mute); opacity: 0;
  transform: translateX(-4px);
  transition: opacity 120ms ease, transform 120ms ease, color 120ms ease;
}
.px-row:hover .px-status-arrow,
.px-row:focus-visible .px-status-arrow {
  opacity: 1; transform: translateX(0); color: var(--k2-text);
}

.px-empty { padding: 40px 20px; text-align: center; color: var(--k2-text-mute); font-size: 13px; }
.px-error {
  padding: 12px 16px;
  background: color-mix(in oklch, var(--k2-bad) 10%, transparent);
  border: 1px solid color-mix(in oklch, var(--k2-bad) 30%, var(--k2-border));
  border-radius: var(--k2-radius); color: var(--k2-bad); font-size: 13px;
  margin-bottom: 16px;
}

.px-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 4px 0; font-size: 12px; color: var(--k2-text-dim); }
.px-pagination-info { font-variant-numeric: tabular-nums; }
.px-pagination-nav { display: inline-flex; align-items: center; gap: 8px; }
.px-pagination-page { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; color: var(--k2-text); }
.px-pagination-btn { width: 28px; height: 28px; display: inline-grid; place-items: center; background: transparent; border: 1px solid var(--k2-border); border-radius: 6px; color: var(--k2-text-dim); cursor: pointer; font-size: 14px; transition: all 120ms; }
.px-pagination-btn:hover:not(:disabled) { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 900px) {
  .px-page { padding: 16px 20px; }
  .px-kpis { grid-template-columns: 1fr; }
  .px-thead { display: none; }
  .px-row { grid-template-columns: 1fr; gap: 6px; padding: 14px 16px; }
}
`
