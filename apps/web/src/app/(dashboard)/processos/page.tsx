'use client'

/**
 * Processos list — Kamaia 2.0 redesign.
 *
 * Shares the visual DNA with /projectos (funnel + toolbar + expandable
 * rows + mini stage timeline) but maps to the real Processo model:
 * processoNumber / ProcessoType / ProcessoStatus / ProcessoPriority /
 * court / opposingParty / prazos[].
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Filter, Users, ArrowUpRight, ChevronDown,
  Scale,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import {
  ProcessoType,
  ProcessoStatus,
  ProcessoPriority,
  PROCESSO_STAGES,
} from '@kamaia/shared-types'
import { ProcessoFormModal } from '@/components/forms/processo-form-modal'

interface ProcessoListRow {
  id: string
  processoNumber: string
  title: string
  type: ProcessoType
  status: ProcessoStatus
  priority: ProcessoPriority
  stage: string | null
  court: string | null
  courtCaseNumber: string | null
  opposingParty: string | null
  openedAt: string
  tags: string[]
  cliente: { id: string; name: string }
  advogado: { id: string; firstName: string; lastName: string }
  prazos?: Array<{ id: string; dueDate: string; isUrgent: boolean; title: string }>
  _count?: { prazos: number; documents: number; timeEntries: number }
}
interface ClienteOption { id: string; name: string }
interface MemberOption { id: string; firstName: string; lastName: string }

const STATUSES: { id: ProcessoStatus; label: string; short: string }[] = [
  { id: ProcessoStatus.ACTIVO, label: 'Activo', short: 'ACT' },
  { id: ProcessoStatus.SUSPENSO, label: 'Suspenso', short: 'SUSP' },
  { id: ProcessoStatus.ENCERRADO, label: 'Encerrado', short: 'ENC' },
  { id: ProcessoStatus.ARQUIVADO, label: 'Arquivado', short: 'ARQ' },
]
const TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Cível',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Família',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}
const PRIORITY: { id: ProcessoPriority; label: string; cls: 'lo' | 'md' | 'hi' }[] = [
  { id: ProcessoPriority.ALTA, label: 'Alta', cls: 'hi' },
  { id: ProcessoPriority.MEDIA, label: 'Média', cls: 'md' },
  { id: ProcessoPriority.BAIXA, label: 'Baixa', cls: 'lo' },
]

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
function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }).replace('.', '')
}
function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function ProcessosPage() {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProcessoStatus | null>(null)
  const [typeFilters, setTypeFilters] = useState<ProcessoType[]>([])
  const [clienteFilters, setClienteFilters] = useState<string[]>([])
  const [advogadoFilters, setAdvogadoFilters] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [showNewProcesso, setShowNewProcesso] = useState(false)
  const PAGE_SIZE = 20

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilters, clienteFilters, advogadoFilters])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        document.getElementById('px-search')?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const { data, loading } = useApi<{ data: ProcessoListRow[] }>('/processos?limit=100')
  const processos = data?.data ?? []

  const { data: clientesData } = useApi<{ data: ClienteOption[] }>('/clientes?limit=200')
  const clientes = clientesData?.data ?? []
  const { data: membersData } = useApi<MemberOption[]>('/team/members')
  const members = membersData ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return processos.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (typeFilters.length && !typeFilters.includes(p.type)) return false
      if (clienteFilters.length && !clienteFilters.includes(p.cliente.id)) return false
      if (advogadoFilters.length && !advogadoFilters.includes(p.advogado.id)) return false
      if (q) {
        const blob = [
          p.processoNumber, p.title, p.cliente.name,
          p.advogado.firstName, p.advogado.lastName,
          p.opposingParty, p.court,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [processos, search, statusFilter, typeFilters, clienteFilters, advogadoFilters])

  return (
    <div className="px-page">
      <style jsx global>{sharedListStyles}</style>

      <div className="px-head">
        <div className="px-title">Processos</div>
        <div className="px-head-actions">
          <button type="button" onClick={() => setShowNewProcesso(true)} className="px-btn-primary">
            <Plus size={14} /> Novo processo
          </button>
        </div>
      </div>

      <div className="px-toolbar">
            <div className="px-search">
              <Search size={14} />
              <input
                id="px-search"
                placeholder="Pesquisar por número, título, parte contrária... (/)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="px-search-clear" onClick={() => setSearch('')}>×</button>
              )}
            </div>
            <FilterChip
              icon={<Filter size={13} />} label="Estado"
              values={statusFilter ? [statusFilter] : []}
              options={STATUSES.map((s) => ({ id: s.id, label: s.label }))}
              onChange={(v) => setStatusFilter((v[0] as ProcessoStatus) ?? null)}
            />
            <FilterChip
              icon={<Filter size={13} />} label="Tipo"
              values={typeFilters as string[]}
              options={Object.values(ProcessoType).map((id) => ({ id, label: TYPE_LABELS[id] }))}
              onChange={(v) => setTypeFilters(v as ProcessoType[])}
            />
            <FilterChip
              icon={<Scale size={13} />} label="Cliente"
              values={clienteFilters}
              options={clientes.map((c) => ({ id: c.id, label: c.name }))}
              onChange={setClienteFilters}
            />
            <FilterChip
              icon={<Users size={13} />} label="Advogado"
              values={advogadoFilters}
              options={members.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }))}
              onChange={setAdvogadoFilters}
            />
          </div>

          <div className="px-table-wrap">
           <div className="px-table">
            <div className="px-thead">
              <div>Processo</div>
              <div>Cliente</div>
              <div>Próximo prazo</div>
              <div>Advogado</div>
              <div style={{ textAlign: 'right' }}>Estado</div>
            </div>
            {loading && processos.length === 0 ? (
              <div className="px-empty">A carregar processos…</div>
            ) : filtered.length === 0 ? (
              <div className="px-empty">
                Sem processos a mostrar. Ajuste filtros ou{' '}
                <Link href="/processos/novo" style={{ color: 'var(--k2-accent)' }}>
                  crie um novo
                </Link>.
              </div>
            ) : (
              filtered
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((p) => (
                  <ProcessoRow
                    key={p.id}
                    processo={p}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    onOpen={() => router.push(`/processos/${p.id}`)}
                  />
                ))
            )}
           </div>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="px-pagination">
              <span className="px-pagination-info">
                {(page - 1) * PAGE_SIZE + 1}
                –
                {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div className="px-pagination-nav">
                <button
                  type="button"
                  className="px-pagination-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >‹</button>
                <span className="px-pagination-page">
                  {page} / {Math.ceil(filtered.length / PAGE_SIZE)}
                </span>
                <button
                  type="button"
                  className="px-pagination-btn"
                  onClick={() =>
                    setPage((p) =>
                      p * PAGE_SIZE < filtered.length ? p + 1 : p,
                    )
                  }
                  disabled={page * PAGE_SIZE >= filtered.length}
                  aria-label="Página seguinte"
                >›</button>
              </div>
            </div>
          )}

      <ProcessoFormModal
        open={showNewProcesso}
        onClose={() => setShowNewProcesso(false)}
        onSuccess={() => setShowNewProcesso(false)}
      />
    </div>
  )
}

function ProcessoRow({
  processo,
  expanded,
  onToggle,
  onOpen,
}: {
  processo: ProcessoListRow
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const stages = PROCESSO_STAGES[processo.type] ?? []
  const curIdx = useMemo(() => {
    if (!processo.stage) return 0
    const idx = stages.findIndex((s) => s === processo.stage)
    return idx >= 0 ? idx : 0
  }, [stages, processo.stage])

  const priority = PRIORITY.find((p) => p.id === processo.priority)!
  const status = STATUSES.find((s) => s.id === processo.status)!

  const nextPrazo = useMemo(() => {
    const future = (processo.prazos ?? [])
      .filter((pz) => new Date(pz.dueDate) >= new Date())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    return future[0] ?? null
  }, [processo.prazos])
  const left = nextPrazo ? formatLeft(nextPrazo.dueDate) : null

  const clientInitials = initialsOf(processo.cliente.name)

  return (
    <>
      <div
        className={`px-row ${expanded ? 'expanded' : ''}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
      >
        {/* Processo */}
        <div className="px-cell-name">
          <span className="name-text">{processo.title}</span>
        </div>
        {/* Cliente */}
        <div className="px-client">
          <div className="px-client-av">{clientInitials}</div>
          <div className="px-client-name">{processo.cliente.name}</div>
        </div>
        {/* Próximo prazo */}
        <div className="px-deadline">
          {nextPrazo && left ? (
            <>
              <div className="px-deadline-date mono">{formatShortDate(nextPrazo.dueDate)}</div>
              <div className={`px-deadline-left ${left.cls}`}>{left.text}</div>
            </>
          ) : (
            <div className="px-deadline-left" style={{ color: 'var(--k2-text-mute)' }}>—</div>
          )}
        </div>
        {/* Advogado */}
        <div className="px-manager">
          {processo.advogado.firstName} {processo.advogado.lastName}
        </div>
        {/* Estado — sinal + label + arrow hover */}
        <div className="px-status" aria-label={`Estado: ${status.label}`}>
          <span className={`px-status-dot ${status.id.toLowerCase()}`} />
          <span className="px-status-label">{status.label}</span>
          <span className="px-status-arrow" aria-hidden="true">
            <ArrowUpRight size={14} />
          </span>
        </div>
      </div>
      {expanded && (
        <div className="px-detail" onClick={(e) => e.stopPropagation()}>
          <div className="px-detail-inner">
            <div>
              <div className="px-detail-sec-title">Fases · {TYPE_LABELS[processo.type]}</div>
              <MiniTimeline stages={stages} curIdx={curIdx} />
              <div className="px-detail-actions">
                <button className="px-mini-btn primary" onClick={onOpen}>
                  <ArrowUpRight size={12} /> Abrir processo
                </button>
                <button className="px-mini-btn" onClick={onOpen}>Alterar fase</button>
                <button className="px-mini-btn" onClick={onOpen}>Registar horas</button>
                <button className="px-mini-btn" onClick={onOpen}>Novo prazo</button>
              </div>
            </div>
            <div>
              <div className="px-detail-sec-title">Identificação</div>
              <div className="px-detail-facts">
                <Fact label="Número" value={processo.processoNumber} />
                <Fact label="Tipo" value={TYPE_LABELS[processo.type]} />
                <Fact label="Estado" value={status.label} />
                <Fact label="Prioridade" value={priority.label} />
                <Fact label="Tribunal" value={processo.court || '—'} />
                <Fact label="Contraparte" value={processo.opposingParty || '—'} />
                <Fact label="Aberto" value={formatShortDate(processo.openedAt)} />
                <Fact label="Peças" value={String(processo._count?.documents ?? 0)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MiniTimeline({ stages, curIdx }: { stages: string[]; curIdx: number }) {
  const total = Math.max(1, stages.length)
  const pct = Math.max(0, ((curIdx + 0.5) / total) * 100)
  return (
    <div className="px-timeline">
      <div className="px-timeline-track" />
      <div className="px-timeline-fill" style={{ width: `${pct}%` }} />
      <div className="px-timeline-steps" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {stages.map((s, i) => {
          const state = i < curIdx ? 'done' : i === curIdx ? 'current' : ''
          return (
            <div key={`${s}-${i}`} className={`px-timeline-step ${state}`}>
              <div className="dot" />
              <div className="lbl">{s}</div>
              <div className="date">{i <= curIdx ? '✓' : '—'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="px-fact-lbl">{label}</div>
      <div className="px-fact-val">{value}</div>
    </div>
  )
}

function FilterChip({
  icon, label, values, options, onChange,
}: {
  icon?: React.ReactNode
  label: string
  values: string[]
  options: { id: string; label: string }[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const active = values.length > 0
  const displayLabel = active && values.length === 1
    ? options.find((o) => o.id === values[0])?.label ?? label
    : label

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.px-popover') && !t.closest('.px-chip')) setOpen(false)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [open])

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={`px-chip ${active ? 'on' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        {icon}
        <span>{displayLabel}</span>
        {active && values.length > 1 && <span className="px-chip-count">{values.length}</span>}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="px-popover">
          {options.map((opt) => {
            const on = values.includes(opt.id)
            return (
              <div
                key={opt.id}
                className={`px-popover-item ${on ? 'on' : ''}`}
                onClick={() => {
                  onChange(on ? values.filter((v) => v !== opt.id) : [...values, opt.id])
                }}
              >
                <span className="px-check" aria-hidden="true">{on ? '✓' : ''}</span>
                <span>{opt.label}</span>
              </div>
            )
          })}
          {active && (
            <div
              className="px-popover-item"
              onClick={() => { onChange([]); setOpen(false) }}
              style={{
                borderTop: '1px solid var(--k2-border)',
                marginTop: 4, paddingTop: 8, color: 'var(--k2-text-mute)',
              }}
            >
              <span>Limpar selecção</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Styles shared with /projectos (class namespace .px-*)
const sharedListStyles = `
.px-page {
  margin: -1rem -1.5rem -1.5rem;
  padding: 24px clamp(20px, 3vw, 40px) 48px;
  color: var(--k2-text);
  background: var(--k2-bg);
  font-feature-settings: 'tnum', 'zero';
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}
.px-page .mono { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.px-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.px-title { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.px-head-actions { display: flex; align-items: center; gap: 8px; }
.px-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 13px; font-weight: 500; border-radius: var(--k2-radius-sm); border: 1px solid transparent; cursor: pointer; transition: all 120ms; text-decoration: none; background: var(--k2-accent); color: var(--k2-accent-fg); }
.px-btn-primary:hover { filter: brightness(1.08); }
.px-funnel { display: grid; gap: 8px; margin-bottom: 16px; }
.px-fstep { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 12px 14px; text-align: left; cursor: pointer; transition: all 150ms; color: var(--k2-text); }
.px-fstep:hover { border-color: var(--k2-border-strong); }
.px-fstep.active { border-color: var(--k2-accent); box-shadow: inset 0 0 0 1px var(--k2-accent); }
.px-fstep-lbl { font-size: 11px; color: var(--k2-text-mute); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.px-fstep-lbl .num { color: var(--k2-text-dim); font-variant-numeric: tabular-nums; }
.px-fstep-value { font-size: 24px; font-weight: 500; letter-spacing: -0.03em; display: flex; align-items: baseline; gap: 6px; }
.px-fstep-value .hint { font-size: 11px; color: var(--k2-text-mute); font-weight: 400; }
.px-fstep-bar { margin-top: 10px; height: 3px; background: var(--k2-bg-elev-2); border-radius: 2px; overflow: hidden; }
.px-fstep-bar-fill { height: 100%; background: var(--k2-accent); border-radius: 2px; }
.px-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.px-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); color: var(--k2-text-mute); }
.px-search input { flex: 1; background: transparent; border: none; outline: none; color: var(--k2-text); font-size: 13px; font-family: inherit; }
.px-search input::placeholder { color: var(--k2-text-mute); }
.px-search-clear { background: transparent; border: none; color: var(--k2-text-mute); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }
.px-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: 12px; font-weight: 500; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text-dim); cursor: pointer; transition: all 120ms; }
.px-chip:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-chip.on { color: var(--k2-text); border-color: var(--k2-accent); background: color-mix(in oklch, var(--k2-accent) 10%, var(--k2-bg)); }
.px-chip-count { font-size: 10px; padding: 1px 5px; background: var(--k2-accent); color: var(--k2-accent-fg); border-radius: 4px; font-weight: 600; }
.px-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 220px; padding: 6px; background: var(--k2-bg-elev); border: 1px solid var(--k2-border-strong); border-radius: var(--k2-radius); box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5); }
.px-popover-item { display: flex; align-items: center; gap: 10px; padding: 6px 10px; font-size: 13px; color: var(--k2-text-dim); border-radius: 6px; cursor: pointer; }
.px-popover-item:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
.px-popover-item.on { color: var(--k2-text); }
.px-check { width: 14px; height: 14px; display: inline-grid; place-items: center; font-size: 11px; color: var(--k2-accent); line-height: 1; }
.px-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid var(--k2-border); border-radius: var(--k2-radius-lg); background: var(--k2-bg); }
.px-table { min-width: 1100px; }
.px-thead, .px-row { display: grid; grid-template-columns: 2.4fr 1.4fr 1.4fr 1.2fr 170px; gap: 16px; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--k2-border); }
.px-thead { background: transparent; font-size: 10px; color: var(--k2-text-mute); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.px-row { cursor: pointer; transition: background 120ms; }
.px-row:hover, .px-row.expanded { background: var(--k2-bg-hover); }
.px-row-chev { color: var(--k2-text-mute); }
.px-cell-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.px-cell-title .ref { font-size: 11px; color: var(--k2-text-mute); flex-shrink: 0; letter-spacing: -0.01em; }
.px-cell-title .name-text { font-size: 14px; font-weight: 500; color: var(--k2-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-cell-sub { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 11px; color: var(--k2-text-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-cell-sub .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--k2-text-mute); opacity: 0.6; }
.px-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--k2-bg-elev-2); border: 1px solid var(--k2-border); color: var(--k2-text-dim); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500; }
.px-client { display: flex; align-items: center; gap: 10px; min-width: 0; }
.px-client-av { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, var(--k2-text-dim), var(--k2-text-mute)); color: var(--k2-bg); font-size: 10px; font-weight: 600; display: grid; place-items: center; flex-shrink: 0; }
.px-client-meta { min-width: 0; }
.px-client-name { font-size: 13px; color: var(--k2-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.px-manager { font-size: 13px; color: var(--k2-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-status { display: flex; align-items: center; justify-content: flex-end; gap: 8px; position: relative; }
.px-status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; box-shadow: 0 0 0 3px color-mix(in oklch, currentColor 15%, transparent); }
.px-status-label { font-size: 12px; color: var(--k2-text-dim); letter-spacing: -0.005em; white-space: nowrap; }
.px-status-arrow { display: inline-flex; align-items: center; color: var(--k2-text-mute); opacity: 0; transform: translateX(-4px); transition: opacity 120ms ease, transform 120ms ease, color 120ms ease; }
.px-row:hover .px-status-arrow, .px-row:focus-visible .px-status-arrow { opacity: 1; transform: translateX(0); color: var(--k2-text); }
.px-status-dot.activo { background: var(--k2-good); color: var(--k2-good); }
.px-status-dot.suspenso { background: var(--k2-warn); color: var(--k2-warn); }
.px-status-dot.arquivado { background: var(--k2-text-mute); color: var(--k2-text-mute); }
.px-status-dot.encerrado { background: var(--k2-accent); color: var(--k2-accent); }
.px-client-kind { font-size: 10px; color: var(--k2-text-mute); }
.px-progress { min-width: 120px; }
.px-progress-top { display: flex; justify-content: space-between; font-size: 11px; color: var(--k2-text-mute); margin-bottom: 4px; }
.px-progress-top .phase { color: var(--k2-text); font-weight: 500; }
.px-progress-bar { display: flex; gap: 2px; }
.px-progress-seg { flex: 1; height: 4px; background: var(--k2-bg-elev-2); border-radius: 2px; }
.px-progress-seg.done { background: var(--k2-text-dim); }
.px-progress-seg.current { background: var(--k2-accent); }
.px-deadline { min-width: 0; }
.px-deadline-date { font-size: 12px; color: var(--k2-text); font-weight: 500; }
.px-deadline-left { font-size: 11px; color: var(--k2-text-mute); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-deadline-left.over { color: var(--k2-bad); }
.px-deadline-left.urgent { color: var(--k2-warn); }
.px-risk { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 12px; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; background: var(--k2-bg-elev-2); border: 1px solid var(--k2-border); color: var(--k2-text-dim); }
.px-risk .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.px-risk.lo { color: var(--k2-good); border-color: color-mix(in oklch, var(--k2-good) 25%, var(--k2-border)); }
.px-risk.md { color: var(--k2-warn); border-color: color-mix(in oklch, var(--k2-warn) 25%, var(--k2-border)); }
.px-risk.hi { color: var(--k2-bad); border-color: color-mix(in oklch, var(--k2-bad) 25%, var(--k2-border)); }
.px-wip { text-align: right; }
.px-wip-val { font-size: 12px; font-weight: 600; color: var(--k2-text); letter-spacing: 0.02em; }
.px-wip-sub { font-size: 10px; color: var(--k2-text-mute); margin-top: 2px; }
.px-detail { background: var(--k2-bg); border-bottom: 1px solid var(--k2-border); padding: 24px 20px 24px 64px; }
.px-detail-inner { display: grid; grid-template-columns: 1.5fr 1fr; gap: 36px; }
.px-detail-sec-title { font-size: 11px; color: var(--k2-text-mute); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; font-weight: 500; }
.px-detail-actions { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.px-mini-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; font-size: 11px; font-weight: 500; background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text-dim); cursor: pointer; transition: all 120ms; }
.px-mini-btn:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-mini-btn.primary { background: var(--k2-accent); color: var(--k2-accent-fg); border-color: transparent; }
.px-mini-btn.primary:hover { filter: brightness(1.08); }
.px-detail-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 18px; }
.px-fact-lbl { font-size: 10px; color: var(--k2-text-mute); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; }
.px-fact-val { font-size: 13px; color: var(--k2-text); font-variant-numeric: tabular-nums; }
.px-timeline { position: relative; padding: 28px 6px 40px; }
.px-timeline-track { position: absolute; left: 0; right: 0; top: 36px; height: 2px; background: var(--k2-bg-elev-2); border-radius: 1px; }
.px-timeline-fill { position: absolute; left: 0; top: 36px; height: 2px; background: var(--k2-accent); border-radius: 1px; }
.px-timeline-steps { position: relative; display: grid; gap: 8px; }
.px-timeline-step { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.px-timeline-step .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--k2-bg-elev-2); border: 2px solid var(--k2-bg-elev-2); }
.px-timeline-step.done .dot { background: var(--k2-text-dim); border-color: var(--k2-text-dim); }
.px-timeline-step.current .dot { background: var(--k2-accent); border-color: var(--k2-accent); }
.px-timeline-step .lbl { font-size: 10px; color: var(--k2-text-dim); text-align: center; letter-spacing: 0.04em; }
.px-timeline-step.current .lbl { color: var(--k2-text); font-weight: 500; }
.px-timeline-step .date { font-size: 10px; color: var(--k2-text-mute); margin-top: 2px; }
.px-empty { padding: 40px 20px; text-align: center; color: var(--k2-text-mute); font-size: 13px; }

.px-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 4px 0; font-size: 12px; color: var(--k2-text-dim); }
.px-pagination-info { font-variant-numeric: tabular-nums; }
.px-pagination-nav { display: inline-flex; align-items: center; gap: 8px; }
.px-pagination-page { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; color: var(--k2-text); }
.px-pagination-btn { width: 28px; height: 28px; display: inline-grid; place-items: center; background: transparent; border: 1px solid var(--k2-border); border-radius: 6px; color: var(--k2-text-dim); cursor: pointer; font-size: 14px; transition: all 120ms; }
.px-pagination-btn:hover:not(:disabled) { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
@media (max-width: 1200px) {
  .px-page { padding: 16px 20px; }
  .px-funnel { grid-template-columns: repeat(2, 1fr) !important; }
  .px-table { min-width: unset; }
  .px-thead, .px-row { grid-template-columns: 24px 1fr !important; }
  .px-thead > :not(:first-child):not(:nth-child(2)), .px-row > :not(:first-child):not(:nth-child(2)) {
    display: none;
  }
}
`
