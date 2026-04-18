'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Briefcase, Users, CheckSquare, TrendingUp, Plus,
  Scale, Link as LinkIcon, Unlink, Search, TrendingDown,
  FileText, AlertTriangle, Bell, X, Download,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PROJECT_CATEGORY_LABELS, ProjectCategory } from '@kamaia/shared-types'
import { GanttChart, toGanttMilestone } from '@/components/gantt/gantt-chart'

interface Stage {
  id: string
  key: string
  label: string
  color: string | null
  allowsParallel: boolean
  isTerminal: boolean
}
interface ProjectDetail {
  id: string
  code: string
  name: string
  category: ProjectCategory
  status: string
  healthStatus: string
  scope: string | null
  objectives: string | null
  startDate: string | null
  endDate: string | null
  budgetAmount: number | null
  budgetCurrency: string
  cliente: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string }
  workflow: { id: string; name: string; stages: Stage[] } | null
  members: Array<{
    id: string
    role: string
    user: { id: string; firstName: string; lastName: string; email: string }
  }>
  milestones: Array<{
    id: string
    title: string
    startDate: string | null
    dueDate: string
    progress: number
    completedAt: string | null
    dependsOnId: string | null
  }>
  processos: Array<{
    id: string
    title: string
    processoNumber: string
    stage: string | null
    status?: string
  }>
}

interface Budget {
  budget: number
  spent: number
  remaining: number | null
  currency: string
  breakdown: { timeCost: number; expenseCost: number }
}

const TABS = [
  { key: 'overview', label: 'Visão geral', icon: Briefcase },
  { key: 'processos', label: 'Processos', icon: Scale },
  { key: 'team', label: 'Equipa', icon: Users },
  { key: 'milestones', label: 'Cronograma', icon: CheckSquare },
  { key: 'budget', label: 'Orçamento', icon: TrendingUp },
  { key: 'burndown', label: 'Burn-down', icon: TrendingDown },
  { key: 'status', label: 'Status Reports', icon: FileText },
]

interface Risk {
  title: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  mitigation?: string | null
}
interface StatusReport {
  id: string
  weekStart: string
  healthStatus: 'GREEN' | 'YELLOW' | 'RED'
  budgetSnapshot: number | null
  actualSpentSnapshot: number | null
  idealSpentSnapshot: number | null
  hoursLoggedMinutes: number
  milestonesTotal: number
  milestonesCompleted: number
  milestonesOverdue: number
  risks: Risk[] | null
  summary: string | null
  createdBy: { id: string; firstName: string; lastName: string }
  createdAt: string
}

interface LinkableProcesso {
  id: string
  processoNumber: string
  title: string
  status: string
  type: string
  projectId: string | null
  cliente: { id: string; name: string } | null
}

interface BurndownPoint {
  date: string
  actualSpent: number
  idealSpent: number
}
interface BurndownResponse {
  budget: number
  currency: string
  totalSpent: number
  series: BurndownPoint[]
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { data: session } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<
    'overview' | 'processos' | 'team' | 'milestones' | 'budget' | 'burndown' | 'status'
  >('overview')

  const { data: project, refetch } = useApi<ProjectDetail>(`/projects/${id}`)
  const { data: budget } = useApi<Budget>(tab === 'budget' ? `/projects/${id}/budget` : null)
  const { data: burndown } = useApi<BurndownResponse>(
    tab === 'burndown' ? `/projects/${id}/burndown` : null,
  )

  // Unread alerts for this project (drift + overdue) — shown as banner
  interface AlertNotification {
    id: string
    type: string
    subject: string | null
    body: string | null
    readAt: string | null
    createdAt: string
    metadata: { projectId?: string; milestoneId?: string }
  }
  const { data: alertsData, refetch: refetchAlerts } = useApi<{
    data: AlertNotification[]
  }>(`/notifications?unread=true&limit=50`)
  const projectAlerts = (alertsData?.data ?? []).filter(
    (n) =>
      (n.type === 'PROJECT_BUDGET_DRIFT' || n.type === 'PROJECT_MILESTONE_OVERDUE') &&
      n.metadata?.projectId === id,
  )

  const dismissAlert = async (notifId: string) => {
    if (!session?.accessToken) return
    try {
      await api(`/notifications/${notifId}/read`, {
        method: 'PATCH',
        token: session.accessToken,
      })
      refetchAlerts()
    } catch {
      /* silent */
    }
  }
  const { data: reports, refetch: refetchReports } = useApi<StatusReport[]>(
    tab === 'status' ? `/projects/${id}/reports` : null,
  )

  const generateReport = async () => {
    if (!session?.accessToken) return
    try {
      await api(`/projects/${id}/reports`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({}),
      })
      toast.success('Relatório gerado')
      refetchReports()
    } catch {
      toast.error('Erro ao gerar relatório')
    }
  }

  const updateReport = async (
    reportId: string,
    patch: { healthStatus?: string; summary?: string; risks?: Risk[] },
  ) => {
    if (!session?.accessToken) return
    try {
      await api(`/projects/reports/${reportId}`, {
        method: 'PUT',
        token: session.accessToken,
        body: JSON.stringify(patch),
      })
      refetchReports()
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  // ── Link processo picker state ────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const { data: linkable, refetch: refetchLinkable } = useApi<LinkableProcesso[]>(
    pickerOpen ? `/projects/${id}/linkable-processos?search=${encodeURIComponent(pickerSearch)}` : null,
    [pickerOpen, pickerSearch],
  )

  const linkProcesso = async (processoId: string) => {
    if (!session?.accessToken) return
    try {
      await api(`/projects/${id}/processos/${processoId}`, {
        method: 'POST',
        token: session.accessToken,
      })
      toast.success('Processo associado ao projecto')
      refetch()
      refetchLinkable()
    } catch {
      toast.error('Erro ao associar processo')
    }
  }

  const unlinkProcesso = async (processoId: string) => {
    if (!session?.accessToken) return
    if (!confirm('Desassociar este processo do projecto?')) return
    try {
      await api(`/projects/${id}/processos/${processoId}`, {
        method: 'DELETE',
        token: session.accessToken,
      })
      toast.success('Processo desassociado')
      refetch()
    } catch {
      toast.error('Erro ao desassociar processo')
    }
  }

  const [milestoneForm, setMilestoneForm] = useState({ title: '', startDate: '', dueDate: '' })

  const addMilestone = async () => {
    if (!session?.accessToken || !milestoneForm.title || !milestoneForm.dueDate) return
    try {
      const dueISO = new Date(milestoneForm.dueDate).toISOString()
      // Default to a 7-day span starting today if user didn't specify start
      const startISO = milestoneForm.startDate
        ? new Date(milestoneForm.startDate).toISOString()
        : new Date(Math.min(Date.now(), new Date(milestoneForm.dueDate).getTime())).toISOString()
      await api(`/projects/${id}/milestones`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          title: milestoneForm.title,
          startDate: startISO,
          dueDate: dueISO,
        }),
      })
      toast.success('Marco adicionado')
      setMilestoneForm({ title: '', startDate: '', dueDate: '' })
      refetch()
    } catch {
      toast.error('Erro ao adicionar marco')
    }
  }

  const toggleMilestone = async (mId: string, done: boolean) => {
    if (!session?.accessToken) return
    try {
      await api(`/projects/milestones/${mId}`, {
        method: 'PUT',
        token: session.accessToken,
        body: JSON.stringify({
          completedAt: done ? new Date().toISOString() : null,
          progress: done ? 100 : 0,
        }),
      })
      refetch()
    } catch {
      toast.error('Erro')
    }
  }

  const commitMilestoneRange = async (
    mId: string,
    patch: { startDate?: string; dueDate?: string; progress?: number },
  ) => {
    if (!session?.accessToken) return
    try {
      await api(`/projects/milestones/${mId}`, {
        method: 'PUT',
        token: session.accessToken,
        body: JSON.stringify(patch),
      })
      refetch()
    } catch {
      toast.error('Erro ao actualizar marco')
    }
  }

  if (!project) {
    return <div className="p-6 text-ink-muted">A carregar...</div>
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <Link href="/projectos" className="p-2 border border-border mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <p className="text-xs font-mono text-ink-muted">{project.code}</p>
          <h1 className="font-display text-2xl font-semibold text-ink">{project.name}</h1>
          <p className="text-sm text-ink-muted">
            {PROJECT_CATEGORY_LABELS[project.category]}
            {project.cliente ? ` · ${project.cliente.name}` : ''}
            {' · '}Gestor: {project.manager.firstName} {project.manager.lastName}
          </p>
        </div>
      </header>

      {/* Alert banner */}
      {projectAlerts.length > 0 && (
        <div className="space-y-2">
          {projectAlerts.slice(0, 3).map((n) => {
            const isCritical = n.type === 'PROJECT_BUDGET_DRIFT'
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 border',
                  isCritical
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
                )}
                role="alert"
              >
                <div
                  className={cn(
                    'mt-0.5 p-1 rounded-full',
                    isCritical
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                  )}
                >
                  {isCritical ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{n.subject}</p>
                  {n.body && (
                    <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{n.body}</p>
                  )}
                </div>
                <button
                  onClick={() => dismissAlert(n.id)}
                  className="p-1 text-ink-muted hover:text-ink hover:bg-surface rounded"
                  aria-label="Dispensar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
          {projectAlerts.length > 3 && (
            <p className="text-xs text-ink-muted px-1">
              E mais {projectAlerts.length - 3} alerta(s) não lido(s) neste projecto.
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px',
                tab === t.key
                  ? 'border-ink text-ink font-medium'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-surface-raised p-5 space-y-4">
            <div>
              <p className="text-xs font-mono text-ink-muted uppercase">Âmbito</p>
              <p className="text-sm text-ink mt-1 whitespace-pre-wrap">
                {project.scope || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-mono text-ink-muted uppercase">Objectivos</p>
              <p className="text-sm text-ink mt-1 whitespace-pre-wrap">
                {project.objectives || '—'}
              </p>
            </div>
            {project.workflow && (
              <div>
                <p className="text-xs font-mono text-ink-muted uppercase mb-1">Workflow</p>
                <div className="flex gap-1.5 flex-wrap">
                  {project.workflow.stages.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 text-[11px] rounded border border-border bg-surface"
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="bg-surface-raised p-4">
              <p className="text-xs font-mono text-ink-muted uppercase mb-1">Estado</p>
              <p className="text-sm font-medium text-ink">{project.status}</p>
            </div>
            <div className="bg-surface-raised p-4">
              <p className="text-xs font-mono text-ink-muted uppercase mb-1">Saúde</p>
              <p className="text-sm font-medium text-ink">{project.healthStatus}</p>
            </div>
            <div className="bg-surface-raised p-4">
              <p className="text-xs font-mono text-ink-muted uppercase mb-1">Datas</p>
              <p className="text-xs text-ink">
                Início: {project.startDate ? new Date(project.startDate).toLocaleDateString('pt-AO') : '—'}
              </p>
              <p className="text-xs text-ink">
                Fim: {project.endDate ? new Date(project.endDate).toLocaleDateString('pt-AO') : '—'}
              </p>
            </div>
            <div className="bg-surface-raised p-4">
              <p className="text-xs font-mono text-ink-muted uppercase mb-1">Processos associados</p>
              <p className="text-lg font-semibold text-ink">{project.processos.length}</p>
            </div>
          </div>
        </section>
      )}

      {tab === 'processos' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {project.processos.length} processo(s) associado(s)
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium"
            >
              <LinkIcon className="w-4 h-4" />
              Associar processo
            </button>
          </div>

          {/* Linked list */}
          <div className="space-y-2">
            {project.processos.length === 0 && (
              <p className="text-sm text-ink-muted text-center py-8">
                Ainda não há processos associados. Use o botão acima para ligar processos
                existentes a este projecto.
              </p>
            )}
            {project.processos.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 bg-surface border border-border"
              >
                <Scale className="w-4 h-4 text-ink-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">
                    <Link href={`/processos/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </p>
                  <p className="text-xs font-mono text-ink-muted">
                    {p.processoNumber}
                    {p.stage ? ` · ${p.stage}` : ''}
                    {p.status ? ` · ${p.status}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => unlinkProcesso(p.id)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-ink-muted hover:text-red-600"
                  aria-label="Desassociar processo"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Desassociar
                </button>
              </div>
            ))}
          </div>

          {/* Picker modal */}
          {pickerOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setPickerOpen(false)}
            >
              <div
                className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Search className="w-4 h-4 text-ink-muted" />
                  <input
                    autoFocus
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Pesquisar por número ou título..."
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="text-xs text-ink-muted hover:text-ink"
                  >
                    Fechar
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto">
                  {(linkable ?? []).length === 0 ? (
                    <p className="text-sm text-ink-muted text-center py-8">
                      Nenhum processo disponível.
                    </p>
                  ) : (
                    <ul>
                      {(linkable ?? []).map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-surface-raised cursor-pointer"
                          onClick={() => linkProcesso(p.id)}
                        >
                          <Scale className="w-4 h-4 text-ink-muted" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink truncate">{p.title}</p>
                            <p className="text-xs font-mono text-ink-muted">
                              {p.processoNumber} · {p.type}
                              {p.cliente ? ` · ${p.cliente.name}` : ''}
                              {p.projectId ? ' · já noutro projecto' : ''}
                            </p>
                          </div>
                          <LinkIcon className="w-4 h-4 text-ink-muted" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'team' && (
        <section className="bg-surface-raised p-5">
          <h3 className="text-sm font-medium text-ink mb-3">Equipa (RACI)</h3>
          <div className="space-y-2">
            {project.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 border border-border"
              >
                <div>
                  <p className="text-sm text-ink">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  <p className="text-xs text-ink-muted">{m.user.email}</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-surface border border-border rounded">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'milestones' && (
        <section className="space-y-4">
          {/* Interactive Gantt */}
          <GanttChart
            milestones={project.milestones.map(toGanttMilestone)}
            onCommit={commitMilestoneRange}
          />

          {/* Add milestone */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-surface-raised">
            <input
              placeholder="Título do marco"
              value={milestoneForm.title}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
              className="md:col-span-5 px-3 py-2 text-sm bg-surface border border-border"
            />
            <input
              type="date"
              aria-label="Início"
              value={milestoneForm.startDate}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, startDate: e.target.value }))}
              className="md:col-span-3 px-3 py-2 text-sm bg-surface border border-border"
            />
            <input
              type="date"
              aria-label="Fim"
              value={milestoneForm.dueDate}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="md:col-span-2 px-3 py-2 text-sm bg-surface border border-border"
            />
            <button
              onClick={addMilestone}
              className="md:col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-ink text-surface rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {/* Compact list for quick toggle + progress */}
          <div className="space-y-2">
            {project.milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 bg-surface border border-border"
              >
                <input
                  type="checkbox"
                  checked={!!m.completedAt}
                  onChange={(e) => toggleMilestone(m.id, e.target.checked)}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm truncate', m.completedAt && 'line-through text-ink-muted')}>
                    {m.title}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {m.startDate && (
                      <>
                        {new Date(m.startDate).toLocaleDateString('pt-AO')} →{' '}
                      </>
                    )}
                    {new Date(m.dueDate).toLocaleDateString('pt-AO')}
                  </p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={m.progress ?? (m.completedAt ? 100 : 0)}
                  onChange={(e) =>
                    commitMilestoneRange(m.id, { progress: parseInt(e.target.value, 10) })
                  }
                  className="w-24"
                  aria-label={`Progresso de ${m.title}`}
                />
                <span className="text-xs font-mono text-ink-muted w-10 text-right">
                  {m.progress ?? 0}%
                </span>
              </div>
            ))}
            {project.milestones.length === 0 && (
              <p className="text-sm text-ink-muted text-center py-4">Sem marcos definidos</p>
            )}
          </div>
        </section>
      )}

      {tab === 'budget' && budget && (
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface-raised p-4">
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Orçamento</p>
            <p className="text-2xl font-semibold text-ink">
              {(budget.budget / 100).toLocaleString('pt-AO')} {budget.currency}
            </p>
          </div>
          <div className="bg-surface-raised p-4">
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Gasto</p>
            <p className="text-2xl font-semibold text-ink">
              {(budget.spent / 100).toLocaleString('pt-AO')} {budget.currency}
            </p>
          </div>
          <div className="bg-surface-raised p-4">
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Restante</p>
            <p className={cn(
              'text-2xl font-semibold',
              (budget.remaining ?? 0) < 0 ? 'text-red-600' : 'text-ink',
            )}>
              {budget.remaining === null
                ? '—'
                : `${(budget.remaining / 100).toLocaleString('pt-AO')} ${budget.currency}`}
            </p>
          </div>
          <div className="bg-surface-raised p-4">
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Breakdown</p>
            <p className="text-xs text-ink">
              Tempo: {(budget.breakdown.timeCost / 100).toLocaleString('pt-AO')}
            </p>
            <p className="text-xs text-ink">
              Despesas: {(budget.breakdown.expenseCost / 100).toLocaleString('pt-AO')}
            </p>
          </div>
        </section>
      )}

      {tab === 'burndown' && burndown && (
        <section className="bg-surface-raised p-5 space-y-4">
          <header>
            <h3 className="text-sm font-medium text-ink">Burn-down — gasto vs ideal</h3>
            <p className="text-xs text-ink-muted">
              Linha vermelha = gasto real acumulado (timesheets + despesas). Linha
              tracejada = consumo linear do orçamento até ao fim do projecto.
            </p>
          </header>

          {burndown.budget === 0 ? (
            <p className="text-sm text-ink-muted text-center py-8">
              Defina um orçamento no projecto para ver a curva ideal.
            </p>
          ) : (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <LineChart
                  data={burndown.series.map((p) => ({
                    date: p.date,
                    'Gasto real': p.actualSpent / 100,
                    'Ideal': p.idealSpent / 100,
                    Orçamento: burndown.budget / 100,
                  }))}
                  margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => {
                      const d = new Date(v)
                      return `${String(d.getDate()).padStart(2, '0')}/${String(
                        d.getMonth() + 1,
                      ).padStart(2, '0')}`
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : `${v}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: 12,
                    }}
                    formatter={(v) =>
                      `${Number(v).toLocaleString('pt-AO')} ${burndown.currency}`
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="Gasto real"
                    stroke="#DC2626"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ideal"
                    stroke="#737373"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Orçamento"
                    stroke="#16A34A"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted">Orçamento</p>
              <p className="text-lg font-semibold text-ink">
                {(burndown.budget / 100).toLocaleString('pt-AO')} {burndown.currency}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted">Gasto</p>
              <p className="text-lg font-semibold text-ink">
                {(burndown.totalSpent / 100).toLocaleString('pt-AO')} {burndown.currency}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted">Restante</p>
              <p
                className={cn(
                  'text-lg font-semibold',
                  burndown.budget - burndown.totalSpent < 0 ? 'text-red-600' : 'text-ink',
                )}
              >
                {burndown.budget
                  ? `${((burndown.budget - burndown.totalSpent) / 100).toLocaleString('pt-AO')} ${burndown.currency}`
                  : '—'}
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === 'status' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              Snapshot semanal de saúde + KPIs. Automáticos à segunda-feira; podes
              gerar manualmente a qualquer momento.
            </p>
            <button
              onClick={generateReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Gerar agora
            </button>
          </div>

          {(reports ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-muted bg-surface-raised">
              Sem relatórios gerados ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {(reports ?? []).map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  accessToken={session?.accessToken ?? ''}
                  onUpdate={(patch) => updateReport(r.id, patch)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function healthBadge(status: 'GREEN' | 'YELLOW' | 'RED') {
  const map = {
    GREEN: { label: 'Saudável', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
    YELLOW: { label: 'Atenção', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
    RED: { label: 'Crítico', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  } as const
  const m = map[status]
  return (
    <span className={cn('px-2 py-0.5 text-[10px] font-mono uppercase rounded', m.cls)}>
      {m.label}
    </span>
  )
}

function ReportCard({
  report,
  onUpdate,
  accessToken,
}: {
  report: StatusReport
  onUpdate: (patch: { healthStatus?: string; summary?: string; risks?: Risk[] }) => void
  accessToken: string
}) {
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(report.summary ?? '')
  const [risks, setRisks] = useState<Risk[]>(report.risks ?? [])
  const [health, setHealth] = useState(report.healthStatus)
  const [exporting, setExporting] = useState(false)

  const exportPdf = async () => {
    setExporting(true)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${apiBase}/projects/reports/${report.id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('PDF export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `status-report-${report.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      /* silent; button visually settles */
    } finally {
      setExporting(false)
    }
  }

  const weekLabel = new Date(report.weekStart).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const save = () => {
    onUpdate({ summary, risks, healthStatus: health })
    setEditing(false)
  }

  return (
    <article className="bg-surface-raised p-5 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-ink-muted">Semana de {weekLabel}</p>
          <p className="text-sm text-ink">
            Gerado por {report.createdBy.firstName} {report.createdBy.lastName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {healthBadge(report.healthStatus)}
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink disabled:opacity-50"
            title="Exportar PDF"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'A exportar...' : 'PDF'}
          </button>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-ink-muted hover:text-ink"
            >
              Editar
            </button>
          )}
        </div>
      </header>

      {/* KPIs grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center py-2 border-y border-border">
        <div>
          <p className="text-[10px] font-mono uppercase text-ink-muted">Horas</p>
          <p className="text-sm font-semibold text-ink">
            {(report.hoursLoggedMinutes / 60).toFixed(1)}h
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-ink-muted">Marcos</p>
          <p className="text-sm font-semibold text-ink">
            {report.milestonesCompleted}/{report.milestonesTotal}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-ink-muted">Atrasados</p>
          <p
            className={cn(
              'text-sm font-semibold',
              report.milestonesOverdue > 0 ? 'text-red-600' : 'text-ink',
            )}
          >
            {report.milestonesOverdue}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-ink-muted">Gasto</p>
          <p className="text-sm font-semibold text-ink">
            {report.actualSpentSnapshot != null
              ? `${(report.actualSpentSnapshot / 100).toLocaleString('pt-AO')}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Narrative */}
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono uppercase text-ink-muted">Saúde</label>
            <select
              value={health}
              onChange={(e) => setHealth(e.target.value as typeof health)}
              className="w-full px-3 py-2 text-sm bg-surface border border-border"
            >
              <option value="GREEN">Saudável</option>
              <option value="YELLOW">Atenção</option>
              <option value="RED">Crítico</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-mono uppercase text-ink-muted">Sumário</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Pontos-chave da semana, decisões, próximos passos"
              className="w-full px-3 py-2 text-sm bg-surface border border-border"
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase text-ink-muted">Riscos</label>
            <div className="space-y-2">
              {risks.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input
                    placeholder="Título"
                    value={r.title}
                    onChange={(e) =>
                      setRisks((rs) =>
                        rs.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    className="col-span-5 px-2 py-1.5 text-sm bg-surface border border-border"
                  />
                  <select
                    value={r.severity}
                    onChange={(e) =>
                      setRisks((rs) =>
                        rs.map((x, idx) =>
                          idx === i ? { ...x, severity: e.target.value as Risk['severity'] } : x,
                        ),
                      )
                    }
                    className="col-span-2 px-2 py-1.5 text-sm bg-surface border border-border"
                  >
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                    <option>CRITICAL</option>
                  </select>
                  <input
                    placeholder="Mitigação"
                    value={r.mitigation ?? ''}
                    onChange={(e) =>
                      setRisks((rs) =>
                        rs.map((x, idx) =>
                          idx === i ? { ...x, mitigation: e.target.value } : x,
                        ),
                      )
                    }
                    className="col-span-4 px-2 py-1.5 text-sm bg-surface border border-border"
                  />
                  <button
                    onClick={() => setRisks((rs) => rs.filter((_, idx) => idx !== i))}
                    className="col-span-1 p-1.5 text-ink-muted hover:text-red-600"
                    aria-label="Remover risco"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setRisks((rs) => [...rs, { title: '', severity: 'MEDIUM', mitigation: '' }])
                }
                className="text-xs text-ink-muted hover:text-ink"
              >
                + risco
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false)
                setSummary(report.summary ?? '')
                setRisks(report.risks ?? [])
                setHealth(report.healthStatus)
              }}
              className="px-3 py-1.5 text-xs border border-border rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              className="px-3 py-1.5 text-xs bg-ink text-surface rounded-lg font-medium"
            >
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <>
          {report.summary && (
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted mb-1">Sumário</p>
              <p className="text-sm text-ink whitespace-pre-wrap">{report.summary}</p>
            </div>
          )}
          {report.risks && report.risks.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted mb-1">Riscos</p>
              <div className="space-y-1">
                {report.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 text-[9px] font-mono rounded',
                        r.severity === 'CRITICAL' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                        r.severity === 'HIGH' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                        r.severity === 'MEDIUM' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                        r.severity === 'LOW' && 'bg-surface border border-border text-ink-muted',
                      )}
                    >
                      {r.severity}
                    </span>
                    <div className="flex-1">
                      <p className="text-ink">{r.title}</p>
                      {r.mitigation && (
                        <p className="text-ink-muted text-[11px]">Mitigação: {r.mitigation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  )
}
