'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import {
  ProjectCategory,
  PROJECT_CATEGORY_LABELS,
} from '@kamaia/shared-types'

interface CustomTemplate {
  id: string
  category: ProjectCategory
  name: string
  description: string | null
  scopeBlurb: string | null
  objectivesBlurb: string | null
  defaultDurationDays: number
  milestones: Array<{
    title: string
    description?: string | null
    startDayOffset: number
    dueDayOffset: number
  }>
  basedOnSystemId: string | null
  custom: boolean
}

export default function TemplateEditorPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: session } = useSession()
  const toast = useToast()

  // Load the entire catalog and pick the right one (endpoint is by-gabinete list)
  const { data: catalog, loading } = useApi<CustomTemplate[]>('/projects/templates')
  const template = catalog?.find((t) => t.id === id && t.custom)

  const [form, setForm] = useState<Omit<CustomTemplate, 'id' | 'custom' | 'basedOnSystemId'>>({
    category: ProjectCategory.OUTRO,
    name: '',
    description: '',
    scopeBlurb: '',
    objectivesBlurb: '',
    defaultDurationDays: 30,
    milestones: [],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (template) {
      setForm({
        category: template.category,
        name: template.name,
        description: template.description ?? '',
        scopeBlurb: template.scopeBlurb ?? '',
        objectivesBlurb: template.objectivesBlurb ?? '',
        defaultDurationDays: template.defaultDurationDays,
        milestones: template.milestones.map((m) => ({ ...m })),
      })
    }
  }, [template])

  const save = async () => {
    if (!session?.accessToken) return
    if (!form.name.trim() || form.milestones.length === 0) {
      toast.error('Nome e pelo menos 1 marco são obrigatórios')
      return
    }
    setSaving(true)
    try {
      await api(`/projects/templates/${id}`, {
        method: 'PUT',
        token: session.accessToken,
        body: JSON.stringify(form),
      })
      toast.success('Template guardado')
      router.push('/projectos')
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const addMilestone = () => {
    setForm((f) => ({
      ...f,
      milestones: [
        ...f.milestones,
        {
          title: '',
          startDayOffset: f.milestones.length
            ? f.milestones[f.milestones.length - 1].dueDayOffset
            : 0,
          dueDayOffset: f.milestones.length
            ? f.milestones[f.milestones.length - 1].dueDayOffset + 7
            : 7,
        },
      ],
    }))
  }

  const removeMilestone = (i: number) =>
    setForm((f) => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))

  const updateMilestone = (i: number, patch: Partial<CustomTemplate['milestones'][0]>) =>
    setForm((f) => ({
      ...f,
      milestones: f.milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="p-6 text-ink-muted">
        Template não encontrado.{' '}
        <Link href="/projectos" className="underline">
          voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/projectos" className="p-2 border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold text-ink">
            Editar template
          </h1>
          <p className="text-xs text-ink-muted">
            {template.basedOnSystemId
              ? `Cópia de: ${template.basedOnSystemId}`
              : 'Template do gabinete'}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </header>

      <div className="bg-surface-raised p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-ink mb-1">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-surface border border-border"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as ProjectCategory }))
              }
              className="w-full px-3 py-2 text-sm bg-surface border border-border"
            >
              {Object.entries(PROJECT_CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Descrição</label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-surface border border-border"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Scope</label>
            <textarea
              value={form.scopeBlurb ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, scopeBlurb: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-surface border border-border"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Objectivos</label>
            <textarea
              value={form.objectivesBlurb ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, objectivesBlurb: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 text-sm bg-surface border border-border"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">
            Duração padrão (dias)
          </label>
          <input
            type="number"
            min={1}
            value={form.defaultDurationDays}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                defaultDurationDays: parseInt(e.target.value, 10) || 1,
              }))
            }
            className="w-32 px-3 py-2 text-sm bg-surface border border-border"
          />
        </div>
      </div>

      <div className="bg-surface-raised p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Marcos</h2>
          <button
            onClick={addMilestone}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-ink text-surface rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar marco
          </button>
        </div>

        <div className="space-y-2">
          {form.milestones.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 border border-border bg-surface"
            >
              <input
                placeholder="Título"
                value={m.title}
                onChange={(e) => updateMilestone(i, { title: e.target.value })}
                className="md:col-span-5 px-3 py-1.5 text-sm bg-surface border border-border"
              />
              <div className="md:col-span-3 flex items-center gap-1.5 text-xs text-ink-muted">
                <span>início d</span>
                <input
                  type="number"
                  min={0}
                  value={m.startDayOffset}
                  onChange={(e) =>
                    updateMilestone(i, { startDayOffset: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-16 px-2 py-1 text-sm bg-surface border border-border"
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-1.5 text-xs text-ink-muted">
                <span>fim d</span>
                <input
                  type="number"
                  min={0}
                  value={m.dueDayOffset}
                  onChange={(e) =>
                    updateMilestone(i, { dueDayOffset: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-16 px-2 py-1 text-sm bg-surface border border-border"
                />
              </div>
              <button
                onClick={() => removeMilestone(i)}
                className="md:col-span-1 p-1.5 text-ink-muted hover:text-red-600"
                aria-label="Remover marco"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {form.milestones.length === 0 && (
            <p className="text-sm text-ink-muted text-center py-4">
              Sem marcos. Adicione pelo menos 1 para poder guardar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
