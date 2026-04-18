'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Briefcase, Users, CheckSquare, TrendingUp, Plus } from 'lucide-react'
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
  processos: Array<{ id: string; title: string; processoNumber: string; stage: string | null }>
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
  { key: 'team', label: 'Equipa', icon: Users },
  { key: 'milestones', label: 'Cronograma', icon: CheckSquare },
  { key: 'budget', label: 'Orçamento', icon: TrendingUp },
]

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { data: session } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<'overview' | 'team' | 'milestones' | 'budget'>('overview')

  const { data: project, refetch } = useApi<ProjectDetail>(`/projects/${id}`)
  const { data: budget } = useApi<Budget>(tab === 'budget' ? `/projects/${id}/budget` : null)

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
    </div>
  )
}
