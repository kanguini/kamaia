'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, GitBranch, Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  key: string
  label: string
  position: number
  color: string | null
  category: string | null
  allowsParallel: boolean
  isTerminal: boolean
}
interface Workflow {
  id: string
  name: string
  scope: 'PROCESSO' | 'PROJECT'
  appliesTo: string[]
  isDefault: boolean
  isArchived: boolean
  stages: Stage[]
  _count?: { processos: number; projects: number }
}

/**
 * Workflow editor — lets a gabinete manager add custom stages like Tréplica
 * or Quadruplica (or any parallel phase) without code changes. Changes here
 * propagate immediately to the Kanban.
 */
export default function WorkflowsPage() {
  const { data: session } = useSession()
  const toast = useToast()
  const { data: workflows, loading, refetch } = useApi<Workflow[]>('/workflows')
  const [selected, setSelected] = useState<string | null>(null)
  const [addingStage, setAddingStage] = useState(false)
  const [stageForm, setStageForm] = useState({
    key: '',
    label: '',
    category: '',
    allowsParallel: false,
    color: '',
  })

  const workflow = workflows?.find((w) => w.id === selected) ?? workflows?.[0]

  const seedIfEmpty = async () => {
    if (!session?.accessToken) return
    try {
      await api('/workflows/seed', { method: 'POST', token: session.accessToken })
      toast.success('Workflows padrão criados')
      refetch()
    } catch {
      toast.error('Não foi possível semear workflows')
    }
  }

  const addStage = async () => {
    if (!workflow || !session?.accessToken) return
    if (!stageForm.key || !stageForm.label) {
      toast.error('Key e label são obrigatórios')
      return
    }
    setAddingStage(true)
    try {
      await api(`/workflows/${workflow.id}/stages`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          key: stageForm.key.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          label: stageForm.label,
          category: stageForm.category || undefined,
          allowsParallel: stageForm.allowsParallel,
          color: stageForm.color || undefined,
        }),
      })
      toast.success(`Fase "${stageForm.label}" adicionada`)
      setStageForm({ key: '', label: '', category: '', allowsParallel: false, color: '' })
      refetch()
    } catch (e: unknown) {
      const msg = (e as { error?: string })?.error || 'Erro ao adicionar fase'
      toast.error(msg)
    } finally {
      setAddingStage(false)
    }
  }

  const deleteStage = async (stageId: string, label: string) => {
    if (!session?.accessToken) return
    if (!confirm(`Remover fase "${label}"?`)) return
    try {
      await api(`/workflows/stages/${stageId}`, {
        method: 'DELETE',
        token: session.accessToken,
      })
      toast.success('Fase removida')
      refetch()
    } catch (e: unknown) {
      const msg = (e as { error?: string })?.error || 'Erro ao remover fase'
      toast.error(msg)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    )
  }

  if (!workflows || workflows.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <GitBranch className="w-12 h-12 text-ink-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-ink mb-2">Nenhum workflow configurado</h2>
        <p className="text-ink-muted mb-6">
          Semeie os workflows padrão (Cível com Tréplica e Quadruplica, Laboral, Criminal,
          M&A, Compliance, etc.) para começar.
        </p>
        <button
          onClick={seedIfEmpty}
          className="px-4 py-2 bg-ink text-surface rounded-lg text-sm font-medium"
        >
          Criar workflows padrão
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">Workflows</h1>
        <p className="text-sm text-ink-muted mt-1">
          Configure as fases dos processos e projectos. Suporta fases paralelas (ex: um
          Incidente que corre em simultâneo com a Tréplica).
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar — workflow list */}
        <aside className="col-span-12 md:col-span-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted px-1">
            Processos
          </p>
          {workflows
            .filter((w) => w.scope === 'PROCESSO' && !w.isArchived)
            .map((w) => (
              <button
                key={w.id}
                onClick={() => setSelected(w.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                  (workflow?.id === w.id)
                    ? 'border-ink bg-surface-raised'
                    : 'border-border hover:bg-surface-raised',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{w.name}</span>
                  <span className="text-xs text-ink-muted">{w.stages.length}</span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {w.appliesTo.join(', ')}
                </p>
              </button>
            ))}

          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted px-1 pt-4">
            Projectos
          </p>
          {workflows
            .filter((w) => w.scope === 'PROJECT' && !w.isArchived)
            .map((w) => (
              <button
                key={w.id}
                onClick={() => setSelected(w.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                  (workflow?.id === w.id)
                    ? 'border-ink bg-surface-raised'
                    : 'border-border hover:bg-surface-raised',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{w.name}</span>
                  <span className="text-xs text-ink-muted">{w.stages.length}</span>
                </div>
              </button>
            ))}
        </aside>

        {/* Detail — stages of selected workflow */}
        <section className="col-span-12 md:col-span-8 space-y-4">
          {workflow && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{workflow.name}</h2>
                  <p className="text-xs text-ink-muted">
                    {workflow.scope} · {workflow.appliesTo.join(', ')}
                  </p>
                </div>
                {workflow.isDefault && (
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-surface-raised border border-border rounded">
                    DEFAULT
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {workflow.stages.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg bg-surface"
                  >
                    <span
                      className="w-2 h-6 rounded-sm"
                      style={{ background: s.color || '#737373' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{s.label}</p>
                      <p className="text-xs text-ink-muted font-mono truncate">
                        {s.key}
                        {s.category ? ` · ${s.category}` : ''}
                        {s.allowsParallel ? ' · paralela' : ''}
                        {s.isTerminal ? ' · terminal' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteStage(s.id, s.label)}
                      className="p-1.5 text-ink-muted hover:text-red-600"
                      aria-label={`Remover ${s.label}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add stage */}
              <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                <p className="text-sm font-medium text-ink">Adicionar fase</p>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    placeholder="Label (ex: Tréplica)"
                    value={stageForm.label}
                    onChange={(e) => setStageForm((f) => ({ ...f, label: e.target.value, key: f.key || e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    className="col-span-6 px-3 py-2 text-sm bg-surface border border-border"
                  />
                  <input
                    placeholder="key (ex: treplica)"
                    value={stageForm.key}
                    onChange={(e) => setStageForm((f) => ({ ...f, key: e.target.value }))}
                    className="col-span-4 px-3 py-2 text-sm bg-surface border border-border font-mono"
                  />
                  <input
                    type="color"
                    value={stageForm.color || '#737373'}
                    onChange={(e) => setStageForm((f) => ({ ...f, color: e.target.value }))}
                    className="col-span-2 h-10 bg-surface border border-border"
                  />
                  <input
                    placeholder="Categoria (opcional, ex: ARTICULADOS)"
                    value={stageForm.category}
                    onChange={(e) => setStageForm((f) => ({ ...f, category: e.target.value }))}
                    className="col-span-8 px-3 py-2 text-sm bg-surface border border-border"
                  />
                  <label className="col-span-4 flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={stageForm.allowsParallel}
                      onChange={(e) => setStageForm((f) => ({ ...f, allowsParallel: e.target.checked }))}
                    />
                    Paralela
                  </label>
                </div>
                <button
                  onClick={addStage}
                  disabled={addingStage}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
