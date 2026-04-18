'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Briefcase, Plus, Circle, Sparkles, X, Copy, Trash2, Pencil } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton } from '@/components/ui'
import {
  ProjectCategory,
  ProjectStatus,
  PROJECT_CATEGORY_LABELS,
  ProjectTemplate,
} from '@kamaia/shared-types'

interface Project {
  id: string
  code: string
  name: string
  category: ProjectCategory
  status: ProjectStatus
  healthStatus: 'GREEN' | 'YELLOW' | 'RED'
  endDate: string | null
  cliente?: { id: string; name: string } | null
  manager?: { id: string; firstName: string; lastName: string }
  _count?: { processos: number; milestones: number; members: number }
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PROPOSTA]: 'Proposta',
  [ProjectStatus.ACTIVO]: 'Activo',
  [ProjectStatus.EM_PAUSA]: 'Em pausa',
  [ProjectStatus.CONCLUIDO]: 'Concluído',
  [ProjectStatus.CANCELADO]: 'Cancelado',
}

const HEALTH_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-600',
  YELLOW: 'text-amber-600',
  RED: 'text-red-600',
}

export default function ProjectsListPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const toast = useToast()
  const [category, setCategory] = useState<'ALL' | ProjectCategory>('ALL')
  const [status, setStatus] = useState<'ALL' | ProjectStatus>('ALL')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<ProjectTemplate | null>(null)
  const [tplForm, setTplForm] = useState({ name: '', startDate: '' })
  const [creating, setCreating] = useState(false)

  const qs = new URLSearchParams()
  if (category !== 'ALL') qs.set('category', category)
  if (status !== 'ALL') qs.set('status', status)

  const { data, loading } = useApi<{ data: Project[] }>(
    `/projects?${qs.toString()}`,
    [category, status],
  )
  const projects = data?.data || []

  const { data: templates, refetch: refetchTemplates } = useApi<
    (ProjectTemplate & { custom?: boolean; basedOnSystemId?: string | null })[]
  >(templatesOpen ? '/projects/templates' : null, [templatesOpen])

  const duplicateTemplate = async (systemId: string) => {
    if (!session?.accessToken) return
    try {
      await api('/projects/templates/duplicate', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ systemId }),
      })
      toast.success('Template duplicado — agora podes editá-lo')
      refetchTemplates()
    } catch {
      toast.error('Erro ao duplicar template')
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!session?.accessToken) return
    if (!confirm('Apagar este template do gabinete?')) return
    try {
      await api(`/projects/templates/${templateId}`, {
        method: 'DELETE',
        token: session.accessToken,
      })
      toast.success('Template apagado')
      refetchTemplates()
    } catch {
      toast.error('Erro ao apagar template')
    }
  }

  const createFromTemplate = async () => {
    if (!activeTemplate || !session?.accessToken) return
    if (!tplForm.name.trim()) {
      toast.error('Indique um nome para o projecto')
      return
    }
    setCreating(true)
    try {
      const created = await api<{ data: { id: string } }>('/projects/from-template', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          templateId: activeTemplate.id,
          name: tplForm.name.trim(),
          startDate: tplForm.startDate
            ? new Date(tplForm.startDate).toISOString()
            : undefined,
        }),
      })
      toast.success('Projecto criado a partir do template')
      setTemplatesOpen(false)
      setActiveTemplate(null)
      setTplForm({ name: '', startDate: '' })
      router.push(`/projectos/${created.data.id}`)
    } catch (e: unknown) {
      const msg = (e as { error?: string })?.error || 'Erro ao criar a partir do template'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink">
            Projectos
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Gestão de projectos jurídicos — litígio, M&A, Compliance, Due Diligence e mais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-raised"
          >
            <Sparkles className="w-4 h-4" />
            Usar template
          </button>
          <Link
            href="/projectos/novo"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Projecto
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'ALL' | ProjectCategory)}
          className="px-3 py-1.5 text-sm bg-surface border border-border"
        >
          <option value="ALL">Todas as categorias</option>
          {Object.entries(PROJECT_CATEGORY_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ALL' | ProjectStatus)}
          className="px-3 py-1.5 text-sm bg-surface border border-border"
        >
          <option value="ALL">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} label="A carregar projectos" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum projecto"
          description="Crie o primeiro projecto jurídico do gabinete."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projectos/${p.id}`}
              className="block bg-surface border border-border p-4 hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-mono text-ink-muted">{p.code}</span>
                <Circle
                  className={cn('w-3 h-3 fill-current', HEALTH_COLORS[p.healthStatus])}
                  aria-label={`Saúde: ${p.healthStatus}`}
                />
              </div>
              <h3 className="text-sm font-medium text-ink line-clamp-2 mb-2">{p.name}</h3>
              <p className="text-xs text-ink-muted">
                {PROJECT_CATEGORY_LABELS[p.category]}
                {p.cliente ? ` · ${p.cliente.name}` : ''}
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-ink-muted">
                <span>{p._count?.processos ?? 0} proc.</span>
                <span>{p._count?.milestones ?? 0} marcos</span>
                <span>{p._count?.members ?? 0} membros</span>
                <span className="ml-auto px-1.5 py-0.5 bg-surface-raised rounded text-[10px] font-mono">
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Template picker modal */}
      {templatesOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (!creating) {
              setTemplatesOpen(false)
              setActiveTemplate(null)
            }
          }}
        >
          <div
            className="bg-surface border border-border rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Escolher template</h2>
                <p className="text-xs text-ink-muted">
                  Pré-popula workflow + marcos típicos para a categoria escolhida
                </p>
              </div>
              <button
                onClick={() => {
                  setTemplatesOpen(false)
                  setActiveTemplate(null)
                }}
                className="p-1.5 hover:bg-surface-raised rounded"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {!activeTemplate ? (
              <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {(templates ?? []).map((t) => {
                  const isCustom = !!t.custom
                  return (
                    <div
                      key={t.id}
                      className="group relative p-4 border border-border rounded-lg hover:border-ink hover:bg-surface-raised transition-colors"
                    >
                      <button
                        onClick={() => setActiveTemplate(t)}
                        className="text-left w-full"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <span className="text-sm font-medium text-ink truncate">
                            {t.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isCustom && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
                                GABINETE
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-raised border border-border rounded">
                              {PROJECT_CATEGORY_LABELS[t.category]}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-ink-muted line-clamp-2 mb-2">
                          {t.description}
                        </p>
                        <p className="text-[10px] font-mono text-ink-muted">
                          {t.milestones.length} marcos · {t.defaultDurationDays}d
                        </p>
                      </button>

                      {/* Actions: system → Duplicate; custom → Edit + Delete */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {isCustom ? (
                          <>
                            <Link
                              href={`/projectos/templates/${t.id}`}
                              className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface rounded"
                              aria-label="Editar"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteTemplate(t.id)
                              }}
                              className="p-1.5 text-ink-muted hover:text-red-600 hover:bg-surface rounded"
                              aria-label="Apagar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              duplicateTemplate(t.id)
                            }}
                            className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface rounded"
                            aria-label="Duplicar para editar"
                            title="Duplicar para o gabinete"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <button
                  onClick={() => setActiveTemplate(null)}
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  ← voltar à lista
                </button>
                <div>
                  <h3 className="text-base font-semibold text-ink">{activeTemplate.name}</h3>
                  <p className="text-sm text-ink-muted mt-1">{activeTemplate.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Nome do projecto <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      placeholder={`Ex: ${activeTemplate.category === 'MA' ? 'Aquisição Empresa X por Y' : activeTemplate.name}`}
                      value={tplForm.name}
                      onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-surface border border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Data de início
                    </label>
                    <input
                      type="date"
                      value={tplForm.startDate}
                      onChange={(e) => setTplForm((f) => ({ ...f, startDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-surface border border-border"
                    />
                    <p className="text-[10px] text-ink-muted mt-1">
                      Se vazio, começa hoje. Duração padrão: {activeTemplate.defaultDurationDays} dias
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-mono uppercase text-ink-muted mb-2">
                    Marcos que serão criados
                  </p>
                  <div className="space-y-1">
                    {activeTemplate.milestones.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-1.5 bg-surface-raised"
                      >
                        <span className="text-[10px] font-mono text-ink-muted w-20">
                          d{m.startDayOffset} → d{m.dueDayOffset}
                        </span>
                        <span className="text-sm text-ink flex-1">{m.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTemplate && (
              <footer className="px-5 py-3 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => setActiveTemplate(null)}
                  disabled={creating}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg text-ink-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={createFromTemplate}
                  disabled={creating || !tplForm.name.trim()}
                  className="px-3 py-1.5 text-sm bg-ink text-surface rounded-lg font-medium disabled:opacity-50"
                >
                  {creating ? 'A criar...' : 'Criar projecto'}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
