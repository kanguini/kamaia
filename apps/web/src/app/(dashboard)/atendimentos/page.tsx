'use client'

/**
 * Atendimento — entrada do pipeline (leads / prospectos).
 *
 * Fluxo: NOVO → EM_ANALISE → QUALIFICADO → CONVERTIDO (Cliente + Processo).
 *                                        └→ PERDIDO
 *
 * UI alinhada com /processos e /clientes (classes .px-*). Cabeçalho tem
 * funil de status; a lista suporta filtros de fonte + atribuição + pesquisa.
 * A acção "Converter" abre um sub-modal; "Perdido"/"Análise"/"Qualificado"
 * são transições in-row via PATCH status.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Search, Plus, ArrowUpRight, CheckCheck, XCircle, Filter,
} from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import {
  AtendimentoStatus,
  ATENDIMENTO_STATUS_LABELS,
  AtendimentoSource,
  ATENDIMENTO_SOURCE_LABELS,
  PaginatedResponse,
} from '@kamaia/shared-types'
import { AtendimentoFormModal } from '@/components/forms/atendimento-form-modal'
import { AtendimentoConvertModal } from '@/components/forms/atendimento-convert-modal'

interface AtendimentoRow {
  id: string
  name: string
  type: 'INDIVIDUAL' | 'EMPRESA'
  nif: string | null
  email: string | null
  phone: string | null
  subject: string
  description: string | null
  source: AtendimentoSource
  status: AtendimentoStatus
  priority: 'ALTA' | 'MEDIA' | 'BAIXA'
  notes: string | null
  lostReason: string | null
  convertedClienteId: string | null
  convertedProcessoId: string | null
  convertedAt: string | null
  createdAt: string
  assignedTo: { id: string; firstName: string; lastName: string } | null
  createdBy: { id: string; firstName: string; lastName: string }
  convertedCliente: { id: string; name: string } | null
  convertedProcesso: { id: string; processoNumber: string; title: string } | null
}

const STATUS_ORDER: AtendimentoStatus[] = [
  AtendimentoStatus.NOVO,
  AtendimentoStatus.EM_ANALISE,
  AtendimentoStatus.QUALIFICADO,
  AtendimentoStatus.CONVERTIDO,
  AtendimentoStatus.PERDIDO,
]

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }).replace('.', '')
}

export default function AtendimentosPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AtendimentoStatus | null>(
    AtendimentoStatus.NOVO,
  )
  const [sourceFilter, setSourceFilter] = useState<AtendimentoSource | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [convertTarget, setConvertTarget] = useState<AtendimentoRow | null>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        document.getElementById('at-search')?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const endpoint = useMemo(() => {
    const p = new URLSearchParams()
    if (statusFilter) p.append('status', statusFilter)
    if (sourceFilter) p.append('source', sourceFilter)
    if (search.trim()) p.append('search', search.trim())
    p.append('limit', '100')
    return `/atendimentos?${p.toString()}`
  }, [statusFilter, sourceFilter, search])

  const { data, loading, refetch } = useApi<PaginatedResponse<AtendimentoRow>>(endpoint, [
    statusFilter,
    sourceFilter,
    search,
  ])
  const { data: stats, refetch: refetchStats } = useApi<Record<string, number>>(
    '/atendimentos/stats',
  )

  const list = data?.data ?? []

  const refreshAll = async () => {
    await Promise.all([refetch(), refetchStats()])
  }

  return (
    <div className="px-page">
      <style jsx global>{localStyles}</style>

      <div className="px-head">
        <div>
          <div className="px-title">Atendimento</div>
          <div className="px-sub">Início do pipeline — contactos e prospectos.</div>
        </div>
        <div className="px-head-actions">
          <button type="button" onClick={() => setShowNew(true)} className="px-btn-primary">
            <Plus size={14} /> Novo atendimento
          </button>
        </div>
      </div>

      {/* Funil por status */}
      <div className="px-funnel" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {STATUS_ORDER.map((s) => {
          const count = stats?.[s] ?? 0
          const active = statusFilter === s
          return (
            <button
              key={s}
              className={`px-fstep ${active ? 'active' : ''}`}
              onClick={() => setStatusFilter(active ? null : s)}
              type="button"
            >
              <div className="px-fstep-lbl">{ATENDIMENTO_STATUS_LABELS[s]}</div>
              <div className="px-fstep-value mono">{count}</div>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="px-toolbar">
        <div className="px-search">
          <Search size={14} />
          <input
            id="at-search"
            placeholder="Pesquisar por nome, assunto, email, telefone... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="px-search-clear" onClick={() => setSearch('')} type="button">
              ×
            </button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={sourceFilter ?? ''}
            onChange={(e) =>
              setSourceFilter(e.target.value ? (e.target.value as AtendimentoSource) : null)
            }
            className="at-select"
          >
            <option value="">Fonte: todas</option>
            {Object.entries(ATENDIMENTO_SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <Filter size={13} className="at-select-icon" />
        </div>
      </div>

      {/* Tabela */}
      <div className="px-table-wrap">
        <div className="px-table">
          <div className="px-thead">
            <div>Prospecto</div>
            <div>Assunto</div>
            <div>Fonte</div>
            <div>Atribuído</div>
            <div style={{ textAlign: 'right' }}>Estado</div>
          </div>
          {loading && list.length === 0 ? (
            <div className="px-empty">A carregar atendimentos…</div>
          ) : list.length === 0 ? (
            <div className="px-empty">
              Sem atendimentos a mostrar. Clique em <strong>Novo atendimento</strong> para
              começar o pipeline.
            </div>
          ) : (
            list.map((a) => (
              <AtendimentoRowView
                key={a.id}
                a={a}
                onConvert={() => setConvertTarget(a)}
                onRefresh={refreshAll}
                onToast={(m, t) => (t === 'error' ? toast.error(m) : toast.success(m))}
              />
            ))
          )}
        </div>
      </div>

      <AtendimentoFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={refreshAll}
      />

      <AtendimentoConvertModal
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        atendimento={convertTarget}
        onSuccess={async () => {
          setConvertTarget(null)
          await refreshAll()
        }}
      />
    </div>
  )
}

/**
 * Linha da tabela — mostra o essencial e oferece acções de transição
 * conforme o estado actual (sem poluir a UI com botões inválidos).
 */
function AtendimentoRowView({
  a,
  onConvert,
  onRefresh,
  onToast,
}: {
  a: AtendimentoRow
  onConvert: () => void
  onRefresh: () => Promise<void>
  onToast: (msg: string, type: 'error' | 'success') => void
}) {
  const { mutate, loading } = useMutation<{ status: AtendimentoStatus; lostReason?: string }>(
    `/atendimentos/${a.id}`,
    'PUT',
  )

  const setStatus = async (status: AtendimentoStatus, lostReason?: string) => {
    const result = await mutate(
      { status, lostReason },
      { onError: (e) => onToast(e.error, 'error') },
    )
    if (result) {
      onToast(`Atendimento movido para ${ATENDIMENTO_STATUS_LABELS[status]}`, 'success')
      await onRefresh()
    }
  }

  const sourceLabel = ATENDIMENTO_SOURCE_LABELS[a.source] ?? a.source
  const isConverted = a.status === AtendimentoStatus.CONVERTIDO
  const isLost = a.status === AtendimentoStatus.PERDIDO
  const canAdvance = !isConverted && !isLost

  return (
    <div className="px-row at-row">
      <div className="px-client">
        <div className="px-client-av">{initialsOf(a.name)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="px-client-name">{a.name}</div>
          <div className="at-sub mono">
            {formatShort(a.createdAt)}
            {a.phone ? ` · ${a.phone}` : ''}
          </div>
        </div>
      </div>

      <div className="at-subject">
        <div className="at-subject-title">{a.subject}</div>
        {isConverted && a.convertedProcesso && (
          <div className="at-sub">
            → {a.convertedProcesso.processoNumber} · {a.convertedProcesso.title}
          </div>
        )}
        {isLost && a.lostReason && <div className="at-sub">Motivo: {a.lostReason}</div>}
      </div>

      <div className="at-source">
        <span className={`at-source-tag src-${a.source.toLowerCase()}`}>{sourceLabel}</span>
      </div>

      <div className="px-manager">
        {a.assignedTo
          ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
          : '—'}
      </div>

      <div className="at-actions">
        <span className={`at-status at-status-${a.status.toLowerCase()}`}>
          {ATENDIMENTO_STATUS_LABELS[a.status]}
        </span>
        {canAdvance && (
          <div className="at-inline-actions">
            {a.status === AtendimentoStatus.NOVO && (
              <button
                type="button"
                className="at-mini"
                disabled={loading}
                onClick={() => setStatus(AtendimentoStatus.EM_ANALISE)}
                title="Marcar em análise"
              >
                Análise
              </button>
            )}
            {a.status === AtendimentoStatus.EM_ANALISE && (
              <button
                type="button"
                className="at-mini"
                disabled={loading}
                onClick={() => setStatus(AtendimentoStatus.QUALIFICADO)}
                title="Qualificar"
              >
                <CheckCheck size={12} /> Qualificar
              </button>
            )}
            {a.status === AtendimentoStatus.QUALIFICADO && (
              <button
                type="button"
                className="at-mini primary"
                disabled={loading}
                onClick={onConvert}
                title="Converter em processo"
              >
                <ArrowUpRight size={12} /> Converter
              </button>
            )}
            <button
              type="button"
              className="at-mini danger"
              disabled={loading}
              onClick={() => {
                const reason = window.prompt('Motivo da perda (opcional):') ?? undefined
                setStatus(AtendimentoStatus.PERDIDO, reason || undefined)
              }}
              title="Marcar como perdido"
            >
              <XCircle size={12} /> Perdido
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const localStyles = `
.px-page { margin: -1rem -1.5rem -1.5rem; padding: 24px clamp(20px, 3vw, 40px) 48px; color: var(--k2-text); background: var(--k2-bg); font-feature-settings: 'tnum','zero'; }
.px-page .mono { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.px-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.px-title { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.px-sub { font-size: 13px; color: var(--k2-text-mute); margin-top: 4px; }
.px-head-actions { display: flex; align-items: center; gap: 8px; }
.px-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 13px; font-weight: 500; border-radius: var(--k2-radius-sm); border: 1px solid transparent; cursor: pointer; background: var(--k2-accent); color: var(--k2-accent-fg); }
.px-btn-primary:hover { filter: brightness(1.08); }

.px-funnel { display: grid; gap: 8px; margin-bottom: 16px; }
.px-fstep { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 12px 14px; text-align: left; cursor: pointer; color: var(--k2-text); transition: all 150ms; }
.px-fstep:hover { border-color: var(--k2-border-strong); }
.px-fstep.active { border-color: var(--k2-accent); box-shadow: inset 0 0 0 1px var(--k2-accent); }
.px-fstep-lbl { font-size: 11px; color: var(--k2-text-mute); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
.px-fstep-value { font-size: 24px; font-weight: 500; letter-spacing: -0.03em; }

.px-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.px-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); color: var(--k2-text-mute); }
.px-search input { flex: 1; background: transparent; border: none; outline: none; color: var(--k2-text); font-size: 13px; font-family: inherit; }
.px-search input::placeholder { color: var(--k2-text-mute); }
.px-search-clear { background: transparent; border: none; color: var(--k2-text-mute); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }

.at-select { appearance: none; padding: 8px 34px 8px 12px; font-size: 13px; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text); cursor: pointer; }
.at-select-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--k2-text-mute); pointer-events: none; }

.px-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid var(--k2-border); border-radius: var(--k2-radius-lg); background: var(--k2-bg); }
.px-table { min-width: 1100px; }
.px-thead, .px-row { display: grid; grid-template-columns: 1.5fr 2fr 0.9fr 1.1fr 1.6fr; gap: 16px; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--k2-border); }
.px-thead { font-size: 10px; color: var(--k2-text-mute); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.px-row { transition: background 120ms; }
.px-row:hover { background: var(--k2-bg-hover); }
.px-client { display: flex; align-items: center; gap: 10px; min-width: 0; }
.px-client-av { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--k2-text-dim), var(--k2-text-mute)); color: var(--k2-bg); font-size: 10px; font-weight: 600; display: grid; place-items: center; flex-shrink: 0; }
.px-client-name { font-size: 13px; color: var(--k2-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.px-manager { font-size: 13px; color: var(--k2-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.at-sub { font-size: 11px; color: var(--k2-text-mute); margin-top: 2px; }
.at-subject-title { font-size: 13px; color: var(--k2-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.at-source-tag { display: inline-block; padding: 2px 8px; font-size: 10px; border-radius: 4px; background: var(--k2-bg-elev-2); border: 1px solid var(--k2-border); color: var(--k2-text-dim); letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500; }

.at-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.at-status { font-size: 10px; padding: 3px 8px; border-radius: 10px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500; background: var(--k2-bg-elev-2); border: 1px solid var(--k2-border); color: var(--k2-text-dim); }
.at-status-novo { color: var(--k2-accent); border-color: color-mix(in oklch, var(--k2-accent) 35%, var(--k2-border)); }
.at-status-em_analise { color: var(--k2-warn); border-color: color-mix(in oklch, var(--k2-warn) 35%, var(--k2-border)); }
.at-status-qualificado { color: var(--k2-good); border-color: color-mix(in oklch, var(--k2-good) 35%, var(--k2-border)); }
.at-status-convertido { background: color-mix(in oklch, var(--k2-good) 15%, var(--k2-bg)); color: var(--k2-good); border-color: color-mix(in oklch, var(--k2-good) 40%, var(--k2-border)); }
.at-status-perdido { color: var(--k2-text-mute); }

.at-inline-actions { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.at-mini { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 11px; font-weight: 500; background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text-dim); cursor: pointer; }
.at-mini:hover:not(:disabled) { color: var(--k2-text); border-color: var(--k2-border-strong); }
.at-mini:disabled { opacity: 0.5; cursor: not-allowed; }
.at-mini.primary { background: var(--k2-accent); color: var(--k2-accent-fg); border-color: transparent; }
.at-mini.primary:hover:not(:disabled) { filter: brightness(1.08); }
.at-mini.danger { color: var(--k2-bad); border-color: color-mix(in oklch, var(--k2-bad) 25%, var(--k2-border)); }
.at-mini.danger:hover:not(:disabled) { background: color-mix(in oklch, var(--k2-bad) 8%, var(--k2-bg)); }

.px-empty { padding: 40px 20px; text-align: center; color: var(--k2-text-mute); font-size: 13px; }

@media (max-width: 1200px) {
  .px-funnel { grid-template-columns: repeat(2, 1fr) !important; }
  .px-table { min-width: unset; }
  .px-thead, .px-row { grid-template-columns: 1fr !important; }
  .px-thead > :not(:first-child), .px-row > :not(:first-child):not(:nth-child(2)) { display: none; }
}
`
