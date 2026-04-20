'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  ProjectCategory,
  PROJECT_CATEGORY_LABELS,
} from '@kamaia/shared-types'

interface ClienteOption {
  id: string
  name: string
}

interface ProjectoFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (projectId: string) => void
}

type CreateProjectPayload = {
  name: string
  category: ProjectCategory
  clienteId?: string | null
  scope?: string
  startDate?: string
  endDate?: string
  budgetAmount?: number
}

const initialForm = {
  name: '',
  category: ProjectCategory.MA,
  clienteId: '',
  scope: '',
  startDate: '',
  endDate: '',
  budgetAmount: '',
}

export function ProjectoFormModal({ open, onClose, onSuccess }: ProjectoFormModalProps) {
  const toast = useToast()
  const { mutate, loading } = useMutation<CreateProjectPayload, { id: string }>(
    '/projects',
    'POST',
  )

  const { data: clientesData } = useApi<{ data: ClienteOption[] }>('/clientes?limit=100')
  const clientes = clientesData?.data || []

  const [form, setForm] = useState(initialForm)

  const handleClose = () => {
    setForm(initialForm)
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    const result = await mutate(
      {
        name: form.name.trim(),
        category: form.category,
        clienteId: form.clienteId || null,
        scope: form.scope || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        budgetAmount: form.budgetAmount
          ? Math.round(parseFloat(form.budgetAmount) * 100)
          : undefined,
      },
      { onError: (err) => toast.error(err.error) },
    )

    if (result?.id) {
      toast.success('Projecto criado')
      onSuccess?.(result.id)
      handleClose()
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Novo Projecto" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Nome <span className="text-danger">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Aquisição Empresa X por Y"
            className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Categoria</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as ProjectCategory }))
              }
              className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            >
              {Object.entries(PROJECT_CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Cliente</label>
            <select
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            >
              <option value="">— Sem cliente (interno) —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Âmbito</label>
          <textarea
            value={form.scope}
            onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
            rows={3}
            placeholder="Objectivos e âmbito do projecto"
            className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Início</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Fim (target)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Orçamento (AOA)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.budgetAmount}
              onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent font-mono"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'flex-1 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5',
              'hover:[background:var(--color-btn-primary-hover)] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar projecto'
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 border border-border text-sm font-medium text-ink-muted hover:bg-surface transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}
