'use client'

/**
 * Clientes — slim list shared with /projectos /processos via .px-* styles.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, Filter, ArrowUpRight, ChevronDown } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { ClienteType, PaginatedResponse } from '@kamaia/shared-types'

interface Cliente {
  id: string
  name: string
  type: ClienteType
  nif: string | null
  email: string | null
  phone: string | null
  _count?: { processos: number }
}

const TYPE_LABEL: Record<ClienteType, string> = {
  [ClienteType.INDIVIDUAL]: 'Individual',
  [ClienteType.EMPRESA]: 'Empresa',
}

export default function ClientesPage() {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClienteType | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Debounce search input → 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter])

  // "/" focuses search
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        document.getElementById('cli-search')?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.append('search', debouncedSearch)
    if (typeFilter) params.append('type', typeFilter)
    params.append('limit', '200')
    return `/clientes?${params.toString()}`
  }, [debouncedSearch, typeFilter])

  const { data, loading, error } = useApi<PaginatedResponse<Cliente>>(endpoint, [
    debouncedSearch,
    typeFilter,
  ])
  const clientes = data?.data ?? []

  const visible = useMemo(
    () => clientes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [clientes, page],
  )

  const open = useCallback(
    (id: string) => router.push(`/clientes/${id}`),
    [router],
  )

  return (
    <div className="px-page">
      <style jsx global>{listStyles}</style>

      <div className="px-head">
        <div className="px-title">Clientes</div>
        <div className="px-head-actions">
          <Link href="/clientes/novo" className="px-btn-primary">
            <Plus size={14} /> Novo cliente
          </Link>
        </div>
      </div>

      <div className="px-toolbar">
        <div className="px-search">
          <Search size={14} />
          <input
            id="cli-search"
            placeholder="Pesquisar por nome, NIF, email... (/)"
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
          label="Tipo"
          value={typeFilter}
          options={[
            { id: ClienteType.INDIVIDUAL, label: 'Individual' },
            { id: ClienteType.EMPRESA, label: 'Empresa' },
          ]}
          onChange={(v) => setTypeFilter(v as ClienteType | null)}
        />
      </div>

      {error && <div className="px-error">{error}</div>}

      <div className="px-table-wrap">
        <div className="px-table">
          <div className="px-thead">
            <div>Cliente</div>
            <div>Tipo</div>
            <div>NIF</div>
            <div>Contactos</div>
            <div style={{ textAlign: 'right' }}>Processos</div>
          </div>
          {loading && clientes.length === 0 ? (
            <div className="px-empty">A carregar clientes…</div>
          ) : clientes.length === 0 ? (
            <div className="px-empty">
              Sem clientes a mostrar. Ajuste a pesquisa ou{' '}
              <Link href="/clientes/novo" style={{ color: 'var(--k2-accent)' }}>
                crie um novo
              </Link>
              .
            </div>
          ) : (
            visible.map((c) => (
              <div
                key={c.id}
                className="px-row"
                onClick={() => open(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') open(c.id)
                }}
              >
                <div className="px-cell-name">
                  <span className="name-text">{c.name}</span>
                </div>
                <div>
                  <span className={`px-status-dot ${c.type.toLowerCase()}`} />
                  <span className="px-type-label">{TYPE_LABEL[c.type]}</span>
                </div>
                <div className="px-mono-cell">{c.nif || '—'}</div>
                <div className="px-contact">
                  <span className="email">{c.email || '—'}</span>
                  {c.phone && <span className="phone">{c.phone}</span>}
                </div>
                <div className="px-status" aria-label="Processos associados">
                  <span className="px-count-pill">{c._count?.processos ?? 0}</span>
                  <span className="px-status-arrow" aria-hidden="true">
                    <ArrowUpRight size={14} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {clientes.length > PAGE_SIZE && (
        <div className="px-pagination">
          <span className="px-pagination-info">
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, clientes.length)} de {clientes.length}
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
              {page} / {Math.ceil(clientes.length / PAGE_SIZE)}
            </span>
            <button
              type="button"
              className="px-pagination-btn"
              onClick={() =>
                setPage((p) => (p * PAGE_SIZE < clientes.length ? p + 1 : p))
              }
              disabled={page * PAGE_SIZE >= clientes.length}
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
// Single-select filter chip (same visual as projectos/processos).
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
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
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

// ─────────────────────────────────────────────────────────────
// Styles — mirrors the /projectos + /processos .px-* namespace.
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

/* Toolbar — no outer card; search + chips are the only shapes */
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

/* Table — single outlined card on pure bg */
.px-table-wrap {
  width: 100%; max-width: 100%; overflow-x: auto;
  border: 1px solid var(--k2-border); border-radius: var(--k2-radius-lg);
  background: var(--k2-bg);
}
.px-table { min-width: 720px; }
.px-thead, .px-row {
  display: grid;
  grid-template-columns: 2.4fr 1.2fr 1fr 1.8fr 120px;
  gap: 16px; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid var(--k2-border);
}
.px-thead {
  background: transparent;
  font-size: 10px; color: var(--k2-text-mute);
  letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500;
}
.px-row {
  cursor: pointer; transition: background 120ms;
}
.px-row:hover { background: var(--k2-bg-hover); }
.px-row:last-child { border-bottom: none; }

.px-cell-name .name-text {
  font-size: 14px; font-weight: 500; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-type-label { font-size: 12px; color: var(--k2-text-dim); margin-left: 8px; }
.px-mono-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; color: var(--k2-text-dim);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-contact { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.px-contact .email {
  font-size: 12px; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-contact .phone {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: var(--k2-text-mute);
}

/* Status / trailing cell */
.px-status {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; position: relative;
}
.px-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
  box-shadow: 0 0 0 3px color-mix(in oklch, currentColor 15%, transparent);
}
.px-status-dot.individual { background: var(--k2-accent); color: var(--k2-accent); }
.px-status-dot.empresa    { background: var(--k2-text-mute); color: var(--k2-text-mute); }
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
.px-count-pill {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; padding: 2px 8px;
  font-size: 12px; font-weight: 500;
  background: var(--k2-bg-hover); color: var(--k2-text);
  border-radius: 10px; font-variant-numeric: tabular-nums;
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
  padding: 14px 4px 0;
  font-size: 12px; color: var(--k2-text-dim);
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
