'use client'

/**
 * Prazos — slim list matching /projectos /processos /clientes.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Filter, ArrowUpRight, ChevronDown, Check,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { PrazoType, PrazoStatus, PaginatedResponse } from '@kamaia/shared-types'
import { PrazoFormModal } from '@/components/forms/prazo-form-modal'

interface Prazo {
  id: string
  title: string
  type: PrazoType
  dueDate: string
  status: PrazoStatus
  isUrgent: boolean
  processo: { id: string; processoNumber: string; title: string }
}

const TYPE_LABEL: Record<PrazoType, string> = {
  [PrazoType.CONTESTACAO]: 'Contestação',
  [PrazoType.RECURSO]: 'Recurso',
  [PrazoType.RESPOSTA]: 'Resposta',
  [PrazoType.ALEGACOES]: 'Alegações',
  [PrazoType.AUDIENCIA]: 'Audiência',
  [PrazoType.OUTRO]: 'Outro',
}
const STATUS_LABEL: Record<PrazoStatus, string> = {
  [PrazoStatus.PENDENTE]: 'Pendente',
  [PrazoStatus.CUMPRIDO]: 'Cumprido',
  [PrazoStatus.EXPIRADO]: 'Expirado',
  [PrazoStatus.CANCELADO]: 'Cancelado',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '')
}
function formatLeft(iso: string): { text: string; cls: 'over' | 'urgent' | 'normal' } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return { text: `${-days}d em atraso`, cls: 'over' }
  if (days === 0) return { text: 'Hoje', cls: 'urgent' }
  if (days <= 7) return { text: `${days}d`, cls: 'urgent' }
  return { text: `${days}d`, cls: 'normal' }
}

export default function PrazosPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PrazoStatus | null>(
    PrazoStatus.PENDENTE,
  )
  const [typeFilter, setTypeFilter] = useState<PrazoType | null>(null)
  const [page, setPage] = useState(1)
  const [showNewPrazo, setShowNewPrazo] = useState(false)
  const PAGE_SIZE = 20

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilter])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        document.getElementById('pz-search')?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.append('status', statusFilter)
    if (typeFilter) params.append('type', typeFilter)
    params.append('limit', '200')
    return `/prazos?${params.toString()}`
  }, [statusFilter, typeFilter])

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Prazo>>(
    endpoint,
    [statusFilter, typeFilter],
  )
  const all = data?.data ?? []

  // Client-side search across title + processo + type
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter((p) => {
      const blob = [
        p.title,
        p.processo.processoNumber,
        p.processo.title,
        TYPE_LABEL[p.type],
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [all, search])

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  const onComplete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!session?.accessToken) return
    try {
      await api(`/prazos/${id}/complete`, {
        method: 'PATCH',
        token: session.accessToken,
      })
      refetch()
    } catch {
      /* non-fatal; row continues to show pending */
    }
  }

  return (
    <div className="px-page">
      <style jsx global>{listStyles}</style>

      <div className="px-head">
        <div className="px-title">Prazos</div>
        <div className="px-head-actions">
          <button type="button" onClick={() => setShowNewPrazo(true)} className="px-btn-primary">
            <Plus size={14} /> Novo prazo
          </button>
        </div>
      </div>

      <div className="px-toolbar">
        <div className="px-search">
          <Search size={14} />
          <input
            id="pz-search"
            placeholder="Pesquisar por título, processo, tipo... (/)"
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
          options={Object.values(PrazoStatus).map((id) => ({
            id,
            label: STATUS_LABEL[id],
          }))}
          onChange={(v) => setStatusFilter(v as PrazoStatus | null)}
        />
        <FilterChip
          icon={<Filter size={13} />}
          label="Tipo"
          value={typeFilter}
          options={Object.values(PrazoType).map((id) => ({
            id,
            label: TYPE_LABEL[id],
          }))}
          onChange={(v) => setTypeFilter(v as PrazoType | null)}
        />
      </div>

      {error && <div className="px-error">{error}</div>}

      <div className="px-table-wrap">
        <div className="px-table">
          <div className="px-thead">
            <div>Prazo</div>
            <div>Processo</div>
            <div>Tipo</div>
            <div>Vencimento</div>
            <div style={{ textAlign: 'right' }}>Estado</div>
          </div>

          {loading && all.length === 0 ? (
            <div className="px-empty">A carregar prazos…</div>
          ) : filtered.length === 0 ? (
            <div className="px-empty">
              Sem prazos a mostrar. Ajuste filtros ou{' '}
              <Link href="/prazos/novo" style={{ color: 'var(--k2-accent)' }}>
                registe um novo
              </Link>
              .
            </div>
          ) : (
            visible.map((p) => {
              const left = formatLeft(p.dueDate)
              const effectiveStatus =
                p.isUrgent && p.status === PrazoStatus.PENDENTE
                  ? 'urgente'
                  : p.status.toLowerCase()
              const effectiveLabel =
                p.isUrgent && p.status === PrazoStatus.PENDENTE
                  ? 'Urgente'
                  : STATUS_LABEL[p.status]
              return (
                <div
                  key={p.id}
                  className="px-row"
                  onClick={() => router.push(`/prazos/${p.id}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="px-cell-name">
                    <span className="name-text">{p.title}</span>
                  </div>
                  <div className="px-linked">
                    <span className="mono">{p.processo.processoNumber}</span>
                    <span className="muted">{p.processo.title}</span>
                  </div>
                  <div className="px-meta">{TYPE_LABEL[p.type]}</div>
                  <div className="px-deadline">
                    <span className="date mono">{formatDate(p.dueDate)}</span>
                    <span className={`left ${left.cls}`}>{left.text}</span>
                  </div>
                  <div className="px-status" aria-label={`Estado: ${effectiveLabel}`}>
                    <span className={`px-status-dot ${effectiveStatus}`} />
                    <span className="px-status-label">{effectiveLabel}</span>
                    {p.status === PrazoStatus.PENDENTE && (
                      <button
                        type="button"
                        className="px-status-check"
                        title="Marcar como cumprido"
                        aria-label="Marcar como cumprido"
                        onClick={(e) => onComplete(p.id, e)}
                      >
                        <Check size={13} />
                      </button>
                    )}
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
        <Pagination
          page={page}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      <PrazoFormModal
        open={showNewPrazo}
        onClose={() => setShowNewPrazo(false)}
        onSuccess={() => { setShowNewPrazo(false); refetch() }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────
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

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}) {
  const pages = Math.ceil(total / pageSize)
  return (
    <div className="px-pagination">
      <span className="px-pagination-info">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="px-pagination-nav">
        <button
          type="button"
          className="px-pagination-btn"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          ‹
        </button>
        <span className="px-pagination-page">
          {page} / {pages}
        </span>
        <button
          type="button"
          className="px-pagination-btn"
          onClick={() => onChange(page * pageSize < total ? page + 1 : page)}
          disabled={page * pageSize >= total}
          aria-label="Página seguinte"
        >
          ›
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const listStyles = `
.px-page {
  margin: -1rem -1.5rem -1.5rem;
  padding: 24px clamp(20px, 3vw, 40px) 48px;
  color: var(--k2-text);
  background: var(--k2-bg);
  min-width: 0; max-width: 100%; overflow-x: clip;
}

.px-head {
  display: flex; align-items: end; justify-content: space-between;
  gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
}
.px-title {
  font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1;
}
.px-head-actions { display: flex; align-items: center; gap: 8px; }

.px-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; font-size: 13px; font-weight: 500;
  background: var(--k2-accent); color: var(--k2-accent-fg);
  border: none; border-radius: var(--k2-radius-sm);
  cursor: pointer; text-decoration: none; transition: filter 120ms;
}
.px-btn-primary:hover { filter: brightness(1.08); }

.px-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.px-search {
  flex: 1; min-width: 220px;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: var(--k2-bg);
  border: 1px solid var(--k2-border); border-radius: var(--k2-radius);
  color: var(--k2-text-mute);
}
.px-search input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--k2-text); font-size: 13px; font-family: inherit;
}
.px-search input::placeholder { color: var(--k2-text-mute); }
.px-search-clear {
  background: transparent; border: none; color: var(--k2-text-mute);
  cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px;
}

.px-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; font-size: 12px; font-weight: 500;
  background: var(--k2-bg); border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius-sm); color: var(--k2-text-dim);
  cursor: pointer; transition: all 120ms;
}
.px-chip:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-chip.on {
  color: var(--k2-text); border-color: var(--k2-accent);
  background: color-mix(in oklch, var(--k2-accent) 10%, var(--k2-bg));
}

.px-popover {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
  min-width: 200px; padding: 6px;
  background: var(--k2-bg); border: 1px solid var(--k2-border-strong);
  border-radius: var(--k2-radius);
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5);
}
.px-popover-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 6px 10px; font-size: 13px; color: var(--k2-text-dim);
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer; text-align: left;
}
.px-popover-item:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
.px-popover-item.on { color: var(--k2-text); }
.px-check {
  width: 14px; display: inline-grid; place-items: center;
  font-size: 10px; color: var(--k2-accent); line-height: 1;
}

.px-table-wrap {
  width: 100%; max-width: 100%; overflow-x: auto;
  border: 1px solid var(--k2-border); border-radius: var(--k2-radius-lg);
  background: var(--k2-bg);
}
.px-table { min-width: 780px; }
.px-thead, .px-row {
  display: grid;
  grid-template-columns: 2.2fr 1.6fr 1fr 1.2fr 180px;
  gap: 16px; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid var(--k2-border);
}
.px-thead {
  background: transparent;
  font-size: 10px; color: var(--k2-text-mute);
  letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500;
}
.px-row { cursor: pointer; transition: background 120ms; }
.px-row:hover { background: var(--k2-bg-hover); }
.px-row:last-child { border-bottom: none; }

.px-cell-name .name-text {
  font-size: 14px; font-weight: 500; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-linked { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.px-linked .mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; color: var(--k2-text);
}
.px-linked .muted {
  font-size: 11px; color: var(--k2-text-mute);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-meta { font-size: 13px; color: var(--k2-text-dim); }

.px-deadline { display: flex; flex-direction: column; gap: 2px; }
.px-deadline .date { font-size: 13px; color: var(--k2-text); }
.px-deadline .left { font-size: 11px; color: var(--k2-text-mute); }
.px-deadline .left.over   { color: var(--k2-bad); }
.px-deadline .left.urgent { color: var(--k2-warn); }

.px-status {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; position: relative;
}
.px-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
  box-shadow: 0 0 0 3px color-mix(in oklch, currentColor 15%, transparent);
}
.px-status-dot.urgente   { background: var(--k2-bad); color: var(--k2-bad); }
.px-status-dot.pendente  { background: var(--k2-warn); color: var(--k2-warn); }
.px-status-dot.cumprido  { background: var(--k2-good); color: var(--k2-good); }
.px-status-dot.expirado  { background: var(--k2-bad); color: var(--k2-bad); }
.px-status-dot.cancelado { background: var(--k2-text-mute); color: var(--k2-text-mute); }

.px-status-label {
  font-size: 12px; color: var(--k2-text-dim);
  letter-spacing: -0.005em; white-space: nowrap;
}
.px-status-arrow {
  display: inline-flex; align-items: center;
  color: var(--k2-text-mute); opacity: 0;
  transform: translateX(-4px);
  transition: opacity 120ms ease, transform 120ms ease, color 120ms ease;
}
.px-status-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; padding: 0;
  background: transparent; border: 1px solid var(--k2-border);
  border-radius: 50%;
  color: var(--k2-text-dim); cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, color 120ms ease, border-color 120ms ease;
}
.px-row:hover .px-status-arrow,
.px-row:focus-visible .px-status-arrow,
.px-row:hover .px-status-check,
.px-row:focus-visible .px-status-check {
  opacity: 1; transform: translateX(0);
}
.px-status-check:hover {
  color: var(--k2-good); border-color: var(--k2-good);
}

.px-empty {
  padding: 40px 20px; text-align: center;
  color: var(--k2-text-mute); font-size: 13px;
}
.px-error {
  padding: 12px 16px;
  background: color-mix(in oklch, var(--k2-bad) 10%, transparent);
  border: 1px solid color-mix(in oklch, var(--k2-bad) 30%, var(--k2-border));
  border-radius: var(--k2-radius);
  color: var(--k2-bad); font-size: 13px;
  margin-bottom: 16px;
}

.px-pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 4px 0; font-size: 12px; color: var(--k2-text-dim);
}
.px-pagination-info { font-variant-numeric: tabular-nums; }
.px-pagination-nav { display: inline-flex; align-items: center; gap: 8px; }
.px-pagination-page {
  min-width: 52px; text-align: center;
  font-variant-numeric: tabular-nums; color: var(--k2-text);
}
.px-pagination-btn {
  width: 28px; height: 28px;
  display: inline-grid; place-items: center;
  background: transparent; border: 1px solid var(--k2-border);
  border-radius: 6px; color: var(--k2-text-dim);
  cursor: pointer; font-size: 14px; transition: all 120ms;
}
.px-pagination-btn:hover:not(:disabled) {
  color: var(--k2-text); border-color: var(--k2-border-strong);
}
.px-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 900px) {
  .px-page { padding: 16px 20px; }
  .px-thead { display: none; }
  .px-row { grid-template-columns: 1fr; gap: 6px; padding: 14px 16px; }
}
`
