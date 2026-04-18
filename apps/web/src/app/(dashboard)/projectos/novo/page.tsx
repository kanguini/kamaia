'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useApi } from '@/hooks/use-api'
import {
  ProjectCategory,
  PROJECT_CATEGORY_LABELS,
} from '@kamaia/shared-types'

interface ClienteOption { id: string; name: string }

export default function NewProjectPage() {
  const router = useRouter()
  const toast = useToast()
  const { mutate, loading } = useMutation<{
    name: string
    category: ProjectCategory
    clienteId?: string | null
    scope?: string
    startDate?: string
    endDate?: string
    budgetAmount?: number
  }, { id: string }>('/projects', 'POST')

  const { data: clientesData } = useApi<{ data: ClienteOption[] }>('/clientes?limit=100')
  const clientes = clientesData?.data || []

  const [form, setForm] = useState({
    name: '',
    category: ProjectCategory.MA,
    clienteId: '',
    scope: '',
    startDate: '',
    endDate: '',
    budgetAmount: '',
  })

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
        budgetAmount: form.budgetAmount ? Math.round(parseFloat(form.budgetAmount) * 100) : undefined,
      },
      { onError: (e) => toast.error(e.error) },
    )
    if (result?.id) {
      toast.success('Projecto criado')
      router.push(`/projectos/${result.id}`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/projectos" className="p-2 border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">Novo Projecto</h1>
      </header>

      <form onSubmit={submit} className="bg-surface-raised p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Aquisição Empresa X por Y"
            className="w-full px-3 py-2 bg-surface border border-border"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProjectCategory }))}
              className="w-full px-3 py-2 bg-surface border border-border"
            >
              {Object.entries(PROJECT_CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Cliente</label>
            <select
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border"
            >
              <option value="">— Sem cliente (interno) —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
            className="w-full px-3 py-2 bg-surface border border-border"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Início</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Fim (target)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Orçamento (AKZ)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.budgetAmount}
              onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
              className="w-full px-3 py-2 bg-surface border border-border"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-ink text-surface rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Criar projecto
          </button>
          <Link
            href="/projectos"
            className="px-4 py-2 border border-border rounded-lg text-sm text-ink-muted"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
