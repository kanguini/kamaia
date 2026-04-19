'use client'

/**
 * Projectos list — Kamaia 2.0 redesign.
 *
 * Faithful port of "kamaia-2-0/project/Projectos v2.html" wired to the
 * real /projects API. Ships three interactive surfaces:
 *   - Funnel by ProjectStatus (top bar, click to filter)
 *   - Toolbar with / search + category/cliente/manager/health chips
 *   - Expandable rows showing a mini stage-timeline + actions
 *
 * Detail drawer deliberately links through to /projectos/[id] instead of
 * duplicating the full detail UI — we already built that rich page.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Sparkles, Search, Plus, Filter, Users, Briefcase, ChevronDown,
  ChevronRight, ArrowUpRight, Pencil, Timer, FileText,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import {
  ProjectCategory,
  ProjectStatus,
  PROJECT_CATEGORY_LABELS,
} from '@kamaia/shared-types'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface WorkflowStage {
  id: string
  key: string
  label: string
  position: number
}
interface Workflow {
  id: string
  name: string
  scope: 'PROCESSO' | 'PROJECT'
  appliesTo: string[]
  isDefault: boolean
  stages: WorkflowStage[]
}

interface ProjectListRow {
  id: string
  code: string
  name: string
  category: ProjectCategory
  status: ProjectStatus
  healthStatus: 'GREEN' | 'YELLOW' | 'RED'
  startDate: string | null
  endDate: string | null
  workflowId: string | null
  cliente: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string }
  _count?: { processos: number; milestones: number; members: number }
  workflow?: { id: string; name: string; stages: WorkflowStage[] }
}

interface ClienteOption { id: string; name: string }
interface MemberOption { id: string; firstName: string; lastName: string }

// ─────────────────────────────────────────────────────────────
// Constants — derived enums
// ─────────────────────────────────────────────────────────────
const STATUSES: { id: ProjectStatus; label: string; short: string }[] = [
  { id: ProjectStatus.PROPOSTA, label: 'Proposta', short: 'PROP' },
  { id: ProjectStatus.ACTIVO, label: 'Activo', short: 'ACT' },
  { id: ProjectStatus.EM_PAUSA, label: 'Em pausa', short: 'PAUS' },
  { id: ProjectStatus.CONCLUIDO, label: 'Concluído', short: 'CONC' },
  { id: ProjectStatus.CANCELADO, label: 'Cancelado', short: 'CANC' },
]

const HEALTH: { id: 'GREEN' | 'YELLOW' | 'RED'; label: string; cls: 'lo' | 'md' | 'hi' }[] = [
  { id: 'GREEN', label: 'Saudável', cls: 'lo' },
  { id: 'YELLOW', label: 'Atenção', cls: 'md' },
  { id: 'RED', label: 'Crítico', cls: 'hi' },
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}
function formatLeft(iso: string): { text: string; cls: 'over' | 'urgent' | 'normal' } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const days = daysBetween(now, d)
  if (days < 0) return { text: `${-days}d em atraso`, cls: 'over' }
  if (days === 0) return { text: 'Hoje', cls: 'urgent' }
  if (days <= 7) return { text: `${days}d`, cls: 'urgent' }
  return { text: `${days}d`, cls: 'normal' }
}
function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '')
}
function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
/**
 * Only return a Workflow if it has a usable `stages` array. The /projects
 * list endpoint embeds a shallow workflow ({id, name}) without stages, so
 * falling back to it naively crashes MiniTimeline / curIdx math. Prefer the
 * full workflow fetched via /workflows?scope=PROJECT; otherwise treat as
 * absent.
 */
function resolveWorkflow(
  mapped: Workflow | undefined,
  embedded: ProjectListRow['workflow'],
): Workflow | undefined {
  if (mapped && Array.isArray(mapped.stages) && mapped.stages.length > 0) return mapped
  if (
    embedded &&
    Array.isArray((embedded as Partial<Workflow>).stages) &&
    ((embedded as Workflow).stages?.length ?? 0) > 0
  ) {
    return embedded as Workflow
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function ProjectosPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | null>(null)
  const [catFilters, setCatFilters] = useState<ProjectCategory[]>([])
  const [clienteFilters, setClienteFilters] = useState<string[]>([])
  const [managerFilters, setManagerFilters] = useState<string[]>([])
  const [healthFilters, setHealthFilters] = useState<Array<'GREEN' | 'YELLOW' | 'RED'>>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // `/` focuses search
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

  const { data, loading, refetch } = useApi<{ data: ProjectListRow[] }>(
    '/projects?limit=100',
  )
  const projects = data?.data ?? []

  // Workflow catalog to resolve stage labels per project
  const { data: workflows } = useApi<Workflow[]>('/workflows?scope=PROJECT')
  const workflowForCategory = useMemo(() => {
    const map = new Map<string, Workflow>()
    ;(workflows ?? []).forEach((w) => {
      w.appliesTo.forEach((cat) => {
        if (!map.has(cat) || w.isDefault) map.set(cat, w)
      })
    })
    return map
  }, [workflows])

  // Clientes + members for filter chips
  const { data: clientesData } = useApi<{ data: ClienteOption[] }>('/clientes?limit=200')
  const clientes = clientesData?.data ?? []
  const { data: membersData } = useApi<MemberOption[]>('/team/members')
  const members = membersData ?? []

  // ── Counts for funnel ────────────────────────────────────
  const counts = useMemo(() => {
    const acc: Record<ProjectStatus, number> = {
      [ProjectStatus.PROPOSTA]: 0,
      [ProjectStatus.ACTIVO]: 0,
      [ProjectStatus.EM_PAUSA]: 0,
      [ProjectStatus.CONCLUIDO]: 0,
      [ProjectStatus.CANCELADO]: 0,
    }
    projects.forEach((p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1
    })
    return acc
  }, [projects])

  // ── Apply filters ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (catFilters.length && !catFilters.includes(p.category)) return false
      if (clienteFilters.length && (!p.cliente || !clienteFilters.includes(p.cliente.id))) return false
      if (managerFilters.length && !managerFilters.includes(p.manager.id)) return false
      if (healthFilters.length && !healthFilters.includes(p.healthStatus)) return false
      if (q) {
        const blob = [p.code, p.name, p.cliente?.name, p.manager.firstName, p.manager.lastName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [projects, search, statusFilter, catFilters, clienteFilters, managerFilters, healthFilters])

  const criticalCount = projects.filter((p) => p.healthStatus === 'RED').length

  const changeStage = async (projectId: string, stageId: string) => {
    if (!session?.accessToken) return
    try {
      // Find stage's label and set project.status (no-op on stage itself for now;
      // the real change-stage endpoint is on processos — for projects we record
      // it via a milestone later).
      await api(`/projects/${projectId}`, {
        method: 'PUT',
        token: session.accessToken,
        body: JSON.stringify({ workflowStageId: stageId }),
      })
      refetch()
    } catch {
      // silent — this is a stretch UI hook
    }
  }

  return (
    <div className="px-page">
      <style jsx global>{projectosStyles}</style>

      {/* Header strip */}
      <div className="px-head">
        <div>
          <div className="px-title">
            Projectos <span className="mono">{String(projects.length).padStart(2, '0')}</span>
          </div>
          <div className="px-sub">
            {criticalCount > 0
              ? `${criticalCount} projecto(s) em estado crítico — atenção`
              : `${counts[ProjectStatus.ACTIVO]} activos, todos saudáveis`}
          </div>
        </div>
        <div className="px-head-actions">
          <button
            className="px-btn-ghost"
            onClick={() => router.push('/configuracoes/workflows')}
          >
            <Sparkles size={14} /> Workflows
          </button>
          <Link href="/projectos/novo" className="px-btn-primary">
            <Plus size={14} /> Novo projecto
          </Link>
        </div>
      </div>

      {/* Funnel */}
      <div className="px-funnel">
        {STATUSES.map((st, i) => {
          const count = counts[st.id] || 0
          const total = projects.length || 1
          const pct = (count / total) * 100
          return (
            <button
              key={st.id}
              className={`px-fstep ${statusFilter === st.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === st.id ? null : st.id)}
            >
              <div className="px-fstep-lbl">
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                {st.label}
              </div>
              <div className="px-fstep-value mono">
                {count}
                <span className="hint">projecto{count === 1 ? '' : 's'}</span>
              </div>
              <div className="px-fstep-bar">
                <div
                  className="px-fstep-bar-fill"
                  style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="px-toolbar">
        <div className="px-search">
          <Search size={14} />
          <input
            id="px-search"
            placeholder="Pesquisar por código, nome, cliente... (/)"
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
          label="Categoria"
          values={catFilters as string[]}
          options={Object.values(ProjectCategory).map((id) => ({
            id,
            label: PROJECT_CATEGORY_LABELS[id],
          }))}
          onChange={(v) => setCatFilters(v as ProjectCategory[])}
        />
        <FilterChip
          icon={<Briefcase size={13} />}
          label="Cliente"
          values={clienteFilters}
          options={clientes.map((c) => ({ id: c.id, label: c.name }))}
          onChange={setClienteFilters}
        />
        <FilterChip
          icon={<Users size={13} />}
          label="Gestor"
          values={managerFilters}
          options={members.map((m) => ({
            id: m.id,
            label: `${m.firstName} ${m.lastName}`,
          }))}
          onChange={setManagerFilters}
        />
        <FilterChip
          icon={<Filter size={13} />}
          label="Saúde"
          values={healthFilters}
          options={HEALTH.map((h) => ({ id: h.id, label: h.label }))}
          onChange={(v) => setHealthFilters(v as Array<'GREEN' | 'YELLOW' | 'RED'>)}
        />
      </div>

      {/* Table */}
      <div className="px-table">
        <div className="px-thead">
          <div />
          <div>Projecto</div>
          <div>Cliente</div>
          <div>Equipa</div>
          <div>Fase</div>
          <div>Próximo marco</div>
          <div>Saúde</div>
          <div style={{ textAlign: 'right' }}>Estado</div>
        </div>
        {loading && projects.length === 0 ? (
          <div className="px-empty">A carregar projectos…</div>
        ) : filtered.length === 0 ? (
          <div className="px-empty">
            Sem projectos a mostrar. Ajuste filtros ou{' '}
            <Link href="/projectos/novo" style={{ color: 'var(--k2-accent)' }}>
              crie um novo
            </Link>
            .
          </div>
        ) : (
          filtered.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              expanded={expandedId === p.id}
              workflow={resolveWorkflow(workflowForCategory.get(p.category), p.workflow)}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onOpen={() => router.push(`/projectos/${p.id}`)}
              onChangeStage={(sid) => changeStage(p.id, sid)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────
function ProjectRow({
  project,
  expanded,
  workflow,
  onToggle,
  onOpen,
}: {
  project: ProjectListRow
  expanded: boolean
  workflow?: Workflow
  onToggle: () => void
  onOpen: () => void
  onChangeStage: (sid: string) => void
}) {
  const cat = project.category
  const catLabel = PROJECT_CATEGORY_LABELS[cat]
  const health = HEALTH.find((h) => h.id === project.healthStatus)!
  const status = STATUSES.find((s) => s.id === project.status)!

  // Derive current stage from endDate position within startDate→endDate
  const curIdx = useMemo(() => {
    const stages = workflow?.stages
    if (!stages || stages.length === 0) return 0
    if (project.status === 'CONCLUIDO') return stages.length - 1
    // Use time progression as a rough proxy
    const start = project.startDate ? new Date(project.startDate).getTime() : 0
    const end = project.endDate ? new Date(project.endDate).getTime() : 0
    if (!start || !end || end <= start) return 0
    const now = Date.now()
    const pct = Math.max(0, Math.min(1, (now - start) / (end - start)))
    return Math.min(stages.length - 1, Math.floor(pct * stages.length))
  }, [workflow, project])
  const curStage = workflow?.stages?.[curIdx]

  const nextDue = project.endDate ? formatLeft(project.endDate) : null

  const clientInitials = project.cliente ? initialsOf(project.cliente.name) : '—'

  return (
    <>
      <div
        className={`px-row ${expanded ? 'expanded' : ''}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
      >
        <div className="px-row-chev">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="px-cell-name">
          <div className="px-cell-title">
            <span className="ref mono">{project.code}</span>
            <span className="name-text">{project.name}</span>
          </div>
          <div className="px-cell-sub">
            <span className="px-tag">{catLabel}</span>
            <span className="dot" />
            <span>
              {project._count?.processos ?? 0}{' '}
              {project._count?.processos === 1 ? 'processo' : 'processos'}
            </span>
            <span className="dot" />
            <span>{project._count?.milestones ?? 0} marcos</span>
            <span className="dot" />
            <span>
              Gestor: {project.manager.firstName} {project.manager.lastName}
            </span>
          </div>
        </div>
        <div className="px-client">
          {project.cliente ? (
            <>
              <div className="px-client-av">{clientInitials}</div>
              <div className="px-client-meta">
                <div className="px-client-name">{project.cliente.name}</div>
                <div className="px-client-kind">Cliente</div>
              </div>
            </>
          ) : (
            <div className="px-client-meta">
              <div className="px-client-name" style={{ color: 'var(--k2-text-mute)' }}>
                Interno
              </div>
              <div className="px-client-kind">Sem cliente</div>
            </div>
          )}
        </div>
        <div>
          <div className="px-members-count">{project._count?.members ?? 1}</div>
        </div>
        <div className="px-progress">
          <div className="px-progress-top">
            <span className="phase">{curStage?.label ?? '—'}</span>
            <span className="pct mono">
              {curIdx + 1}/{workflow?.stages.length ?? 1}
            </span>
          </div>
          <div className="px-progress-bar">
            {(workflow?.stages ?? [{ id: '_' } as WorkflowStage]).map((s, i) => (
              <div
                key={s.id}
                className={`px-progress-seg ${i < curIdx ? 'done' : i === curIdx ? 'current' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="px-deadline">
          {nextDue ? (
            <>
              <div className="px-deadline-date mono">
                {formatShortDate(project.endDate)}
              </div>
              <div className={`px-deadline-left ${nextDue.cls}`}>
                {nextDue.text}
              </div>
            </>
          ) : (
            <>
              <div className="px-deadline-date" style={{ color: 'var(--k2-text-mute)' }}>
                —
              </div>
              <div className="px-deadline-left">Sem fim definido</div>
            </>
          )}
        </div>
        <div>
          <span className={`px-risk ${health.cls}`}>
            <span className="dot" />
            {health.label}
          </span>
        </div>
        <div className="px-wip">
          <div className="px-wip-val mono">{status.short}</div>
          <div className="px-wip-sub">
            {project._count?.members ?? 1}{' '}
            {project._count?.members === 1 ? 'membro' : 'membros'}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-detail" onClick={(e) => e.stopPropagation()}>
          <div className="px-detail-inner">
            <div>
              <div className="px-detail-sec-title">
                Workflow — {workflow?.name ?? 'Sem workflow'}
              </div>
              {workflow ? (
                <MiniTimeline workflow={workflow} curIdx={curIdx} />
              ) : (
                <div style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>
                  Este projecto não tem workflow atribuído. Abre o detalhe para
                  associar um.
                </div>
              )}
              <div className="px-detail-actions">
                <button
                  className="px-mini-btn primary"
                  onClick={onOpen}
                >
                  <ArrowUpRight size={12} /> Abrir projecto
                </button>
                <button className="px-mini-btn" onClick={onOpen}>
                  <Pencil size={12} /> Alterar fase
                </button>
                <button className="px-mini-btn" onClick={() => onOpen()}>
                  <Timer size={12} /> Registar horas
                </button>
                <button className="px-mini-btn" onClick={() => onOpen()}>
                  <FileText size={12} /> Novo marco
                </button>
              </div>
            </div>
            <div>
              <div className="px-detail-sec-title">Resumo</div>
              <div className="px-detail-facts">
                <Fact
                  label="Iniciado"
                  value={project.startDate ? formatShortDate(project.startDate) : '—'}
                />
                <Fact
                  label="Fim (target)"
                  value={project.endDate ? formatShortDate(project.endDate) : '—'}
                />
                <Fact label="Estado" value={status.label} />
                <Fact label="Saúde" value={health.label} />
                <Fact label="Processos" value={String(project._count?.processos ?? 0)} />
                <Fact label="Marcos" value={String(project._count?.milestones ?? 0)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MiniTimeline({ workflow, curIdx }: { workflow: Workflow; curIdx: number }) {
  const stages = workflow.stages ?? []
  if (stages.length === 0) {
    return (
      <div style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>
        Workflow sem etapas definidas.
      </div>
    )
  }
  const total = stages.length
  const pct = Math.max(0, ((curIdx + 0.5) / total) * 100)
  return (
    <div className="px-timeline">
      <div className="px-timeline-track" />
      <div className="px-timeline-fill" style={{ width: `${pct}%` }} />
      <div
        className="px-timeline-steps"
        style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
      >
        {stages.map((s, i) => {
          const state = i < curIdx ? 'done' : i === curIdx ? 'current' : ''
          return (
            <div key={s.id} className={`px-timeline-step ${state}`}>
              <div className="dot" />
              <div className="lbl">{s.label}</div>
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

// ─────────────────────────────────────────────────────────────
// FilterChip
// ─────────────────────────────────────────────────────────────
function FilterChip({
  icon,
  label,
  values,
  options,
  onChange,
}: {
  icon?: React.ReactNode
  label: string
  values: string[]
  options: { id: string; label: string }[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const active = values.length > 0
  const displayLabel =
    active && values.length === 1
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
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {icon}
        <span>{displayLabel}</span>
        {active && values.length > 1 && (
          <span className="px-chip-count">{values.length}</span>
        )}
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
                  onChange(
                    on ? values.filter((v) => v !== opt.id) : [...values, opt.id],
                  )
                }}
              >
                <span className="px-check" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                <span>{opt.label}</span>
              </div>
            )
          })}
          {active && (
            <div
              className="px-popover-item"
              onClick={() => {
                onChange([])
                setOpen(false)
              }}
              style={{
                borderTop: '1px solid var(--k2-border)',
                marginTop: 4,
                paddingTop: 8,
                color: 'var(--k2-text-mute)',
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

// ─────────────────────────────────────────────────────────────
// Styles (scoped via jsx global, prefixed .px-*)
// ─────────────────────────────────────────────────────────────
const projectosStyles = `
.px-page {
  margin: -1rem -1.5rem -1.5rem;
  padding: 24px 40px 48px;
  color: var(--k2-text);
  background: var(--k2-bg);
  font-feature-settings: 'tnum', 'zero';
}
.px-page .mono { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

.px-head {
  display: flex; align-items: end; justify-content: space-between; gap: 16px;
  margin-bottom: 20px; flex-wrap: wrap;
}
.px-title {
  font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1;
  display: flex; align-items: baseline; gap: 10px;
}
.px-title .mono { font-size: 20px; color: var(--k2-text-mute); font-weight: 400; }
.px-sub { color: var(--k2-text-dim); font-size: 13px; margin-top: 4px; }

.px-head-actions { display: flex; align-items: center; gap: 8px; }
.px-btn-primary, .px-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; font-size: 13px; font-weight: 500;
  border-radius: var(--k2-radius-sm); border: 1px solid transparent;
  cursor: pointer; transition: all 120ms; text-decoration: none;
}
.px-btn-primary { background: var(--k2-accent); color: var(--k2-accent-fg); }
.px-btn-primary:hover { filter: brightness(1.08); }
.px-btn-ghost {
  color: var(--k2-text-dim); border-color: var(--k2-border); background: var(--k2-bg-elev);
}
.px-btn-ghost:hover {
  color: var(--k2-text); border-color: var(--k2-border-strong); background: var(--k2-bg-hover);
}

.px-funnel {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  margin-bottom: 16px;
}
.px-fstep {
  background: var(--k2-bg-elev); border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius); padding: 12px 14px;
  text-align: left; cursor: pointer; transition: all 150ms;
  color: var(--k2-text);
}
.px-fstep:hover { border-color: var(--k2-border-strong); }
.px-fstep.active {
  border-color: var(--k2-accent);
  box-shadow: inset 0 0 0 1px var(--k2-accent);
}
.px-fstep-lbl {
  font-size: 11px; color: var(--k2-text-mute);
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;
  display: flex; align-items: center; gap: 8px;
}
.px-fstep-lbl .num { color: var(--k2-text-dim); font-variant-numeric: tabular-nums; }
.px-fstep-value {
  font-size: 24px; font-weight: 500; letter-spacing: -0.03em;
  display: flex; align-items: baseline; gap: 6px;
}
.px-fstep-value .hint {
  font-size: 11px; color: var(--k2-text-mute); font-weight: 400;
}
.px-fstep-bar {
  margin-top: 10px; height: 3px; background: var(--k2-bg-elev-2);
  border-radius: 2px; overflow: hidden;
}
.px-fstep-bar-fill { height: 100%; background: var(--k2-accent); border-radius: 2px; }

.px-toolbar {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
  padding: 10px; background: var(--k2-bg-elev);
  border: 1px solid var(--k2-border); border-radius: var(--k2-radius);
}
.px-search {
  flex: 1; min-width: 220px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; background: var(--k2-bg);
  border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm);
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
  padding: 6px 10px; font-size: 12px; font-weight: 500;
  background: var(--k2-bg); border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius-sm); color: var(--k2-text-dim);
  cursor: pointer; transition: all 120ms;
}
.px-chip:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-chip.on {
  color: var(--k2-text); border-color: var(--k2-accent);
  background: color-mix(in oklch, var(--k2-accent) 10%, var(--k2-bg));
}
.px-chip-count {
  font-size: 10px; padding: 1px 5px; background: var(--k2-accent);
  color: var(--k2-accent-fg); border-radius: 4px; font-weight: 600;
}

.px-popover {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
  min-width: 220px; padding: 6px;
  background: var(--k2-bg-elev); border: 1px solid var(--k2-border-strong);
  border-radius: var(--k2-radius);
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5);
}
.px-popover-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px; font-size: 13px; color: var(--k2-text-dim);
  border-radius: 6px; cursor: pointer;
}
.px-popover-item:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
.px-popover-item.on { color: var(--k2-text); }
.px-check {
  width: 14px; height: 14px; display: inline-grid; place-items: center;
  font-size: 11px; color: var(--k2-accent); line-height: 1;
}

.px-table {
  background: var(--k2-bg-elev); border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius-lg); overflow: hidden;
  min-width: 1100px; overflow-x: auto;
}
.px-thead, .px-row {
  display: grid;
  grid-template-columns: 32px 2.2fr 1.4fr 52px 1.3fr 1.1fr 0.9fr 0.7fr;
  gap: 12px; align-items: center;
  padding: 12px 20px; border-bottom: 1px solid var(--k2-border);
}
.px-thead {
  background: var(--k2-bg-elev-2);
  font-size: 10px; color: var(--k2-text-mute);
  letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500;
}
.px-row {
  cursor: pointer; transition: background 120ms;
}
.px-row:hover, .px-row.expanded { background: var(--k2-bg-hover); }
.px-row-chev { color: var(--k2-text-mute); }
.px-cell-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.px-cell-title .ref {
  font-size: 11px; color: var(--k2-text-mute); flex-shrink: 0;
  letter-spacing: -0.01em;
}
.px-cell-title .name-text {
  font-size: 14px; font-weight: 500; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-cell-sub {
  display: flex; align-items: center; gap: 8px; margin-top: 4px;
  font-size: 11px; color: var(--k2-text-mute);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-cell-sub .dot {
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--k2-text-mute); opacity: 0.6;
}
.px-tag {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--k2-bg-elev-2); border: 1px solid var(--k2-border);
  color: var(--k2-text-dim); text-transform: uppercase;
  letter-spacing: 0.04em; font-weight: 500;
}

.px-client { display: flex; align-items: center; gap: 10px; min-width: 0; }
.px-client-av {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg, var(--k2-text-dim), var(--k2-text-mute));
  color: var(--k2-bg); font-size: 10px; font-weight: 600;
  display: grid; place-items: center; flex-shrink: 0;
}
.px-client-meta { min-width: 0; }
.px-client-name {
  font-size: 12px; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-client-kind { font-size: 10px; color: var(--k2-text-mute); }

.px-members-count {
  font-size: 15px; font-weight: 500; color: var(--k2-text);
  font-variant-numeric: tabular-nums;
}

.px-progress { min-width: 120px; }
.px-progress-top {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--k2-text-mute); margin-bottom: 4px;
}
.px-progress-top .phase { color: var(--k2-text); font-weight: 500; }
.px-progress-bar { display: flex; gap: 2px; }
.px-progress-seg {
  flex: 1; height: 4px; background: var(--k2-bg-elev-2); border-radius: 2px;
}
.px-progress-seg.done { background: var(--k2-text-dim); }
.px-progress-seg.current { background: var(--k2-accent); }

.px-deadline { min-width: 0; }
.px-deadline-date {
  font-size: 12px; color: var(--k2-text); font-weight: 500;
}
.px-deadline-left { font-size: 11px; color: var(--k2-text-mute); margin-top: 2px; }
.px-deadline-left.over { color: var(--k2-bad); }
.px-deadline-left.urgent { color: var(--k2-warn); }

.px-risk {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 8px; border-radius: 12px;
  font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500;
  background: var(--k2-bg-elev-2); border: 1px solid var(--k2-border);
  color: var(--k2-text-dim);
}
.px-risk .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.px-risk.lo { color: var(--k2-good); border-color: color-mix(in oklch, var(--k2-good) 25%, var(--k2-border)); }
.px-risk.md { color: var(--k2-warn); border-color: color-mix(in oklch, var(--k2-warn) 25%, var(--k2-border)); }
.px-risk.hi { color: var(--k2-bad); border-color: color-mix(in oklch, var(--k2-bad) 25%, var(--k2-border)); }

.px-wip { text-align: right; }
.px-wip-val { font-size: 12px; font-weight: 600; color: var(--k2-text); letter-spacing: 0.02em; }
.px-wip-sub { font-size: 10px; color: var(--k2-text-mute); margin-top: 2px; }

.px-detail {
  background: var(--k2-bg);
  border-bottom: 1px solid var(--k2-border);
  padding: 24px 20px 24px 64px;
}
.px-detail-inner { display: grid; grid-template-columns: 1.5fr 1fr; gap: 36px; }
.px-detail-sec-title {
  font-size: 11px; color: var(--k2-text-mute);
  letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 12px; font-weight: 500;
}
.px-detail-actions {
  display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap;
}
.px-mini-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; font-size: 11px; font-weight: 500;
  background: var(--k2-bg-elev); border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius-sm); color: var(--k2-text-dim);
  cursor: pointer; transition: all 120ms;
}
.px-mini-btn:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-mini-btn.primary {
  background: var(--k2-accent); color: var(--k2-accent-fg); border-color: transparent;
}
.px-mini-btn.primary:hover { filter: brightness(1.08); }
.px-detail-facts {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 18px;
}
.px-fact-lbl {
  font-size: 10px; color: var(--k2-text-mute);
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px;
}
.px-fact-val {
  font-size: 13px; color: var(--k2-text); font-variant-numeric: tabular-nums;
}

.px-timeline {
  position: relative; padding: 28px 6px 40px;
}
.px-timeline-track {
  position: absolute; left: 0; right: 0; top: 36px; height: 2px;
  background: var(--k2-bg-elev-2); border-radius: 1px;
}
.px-timeline-fill {
  position: absolute; left: 0; top: 36px; height: 2px;
  background: var(--k2-accent); border-radius: 1px;
}
.px-timeline-steps {
  position: relative; display: grid; gap: 8px;
}
.px-timeline-step {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.px-timeline-step .dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--k2-bg-elev-2); border: 2px solid var(--k2-bg-elev-2);
}
.px-timeline-step.done .dot { background: var(--k2-text-dim); border-color: var(--k2-text-dim); }
.px-timeline-step.current .dot { background: var(--k2-accent); border-color: var(--k2-accent); }
.px-timeline-step .lbl {
  font-size: 10px; color: var(--k2-text-dim); text-align: center;
  letter-spacing: 0.04em;
}
.px-timeline-step.current .lbl { color: var(--k2-text); font-weight: 500; }
.px-timeline-step .date {
  font-size: 10px; color: var(--k2-text-mute); margin-top: 2px;
}

.px-empty {
  padding: 40px 20px; text-align: center;
  color: var(--k2-text-mute); font-size: 13px;
}

@media (max-width: 1200px) {
  .px-page { padding: 16px 20px; }
  .px-funnel { grid-template-columns: repeat(3, 1fr); }
  .px-table { min-width: unset; }
  .px-thead, .px-row { grid-template-columns: 24px 1fr; }
  .px-thead > :not(:first-child):not(:nth-child(2)), .px-row > :not(:first-child):not(:nth-child(2)) {
    display: none;
  }
}
`
