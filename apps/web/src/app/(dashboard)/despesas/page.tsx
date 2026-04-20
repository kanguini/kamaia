'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Receipt, Plus, X } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton, IconButton, Modal } from '@/components/ui'
import { ExpenseCategory } from '@kamaia/shared-types'
import { useSession } from 'next-auth/react'

interface Expense {
  id: string
  description: string
  amountCentavos: number
  date: string
  category: ExpenseCategory
  processo: {
    id: string
    processoNumber: string
    title: string
  }
}

interface Processo {
  id: string
  processoNumber: string
  title: string
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.EMOLUMENTOS]: 'Emolumentos',
  [ExpenseCategory.DESLOCACAO]: 'Deslocação',
  [ExpenseCategory.COPIAS]: 'Copias',
  [ExpenseCategory.HONORARIOS_PERITOS]: 'Honorarios de Peritos',
  [ExpenseCategory.OUTRO]: 'Outro',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.EMOLUMENTOS]: 'bg-danger-bg text-danger-text border-danger',
  [ExpenseCategory.DESLOCACAO]: 'bg-warning-bg text-warning-text border-warning',
  [ExpenseCategory.COPIAS]: 'bg-surface-raised text-ink-muted border-border',
  [ExpenseCategory.HONORARIOS_PERITOS]: 'bg-info-bg text-info-text border-info',
  [ExpenseCategory.OUTRO]: 'bg-surface-raised text-ink-muted border-border',
}

function formatMoney(centavos: number): string {
  return `${(centavos / 100).toLocaleString('pt-AO')} AKZ`
}

export default function DespesasPage() {
  const { data: session } = useSession()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)

  const [formProcessoId, setFormProcessoId] = useState<string>('')
  const [formCategory, setFormCategory] = useState<ExpenseCategory>(ExpenseCategory.EMOLUMENTOS)
  const [formDescription, setFormDescription] = useState<string>('')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formError, setFormError] = useState<string>('')

  const { data: expensesData, loading, error, refetch } = useApi<{ data: Expense[] }>('/expenses')
  const expenses = expensesData?.data || []
  const { data: processosData } = useApi<{ data: Processo[] }>('/processos?limit=1000')
  const processos = processosData?.data || []

  const { mutate: createExpense, loading: creating } = useMutation<{
    processoId: string
    category: ExpenseCategory
    description: string
    amountCentavos: number
    date: string
  }>('/expenses', 'POST')

  const deleteExpenseFn = async (expId: string) => {
    if (!session?.accessToken) return null
    try {
      await api(`/expenses/${expId}`, { method: 'DELETE', token: session.accessToken })
      return true
    } catch { return null }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formProcessoId) {
      setFormError('Seleccione um processo')
      return
    }

    if (!formDescription.trim()) {
      setFormError('Descricao e obrigatoria')
      return
    }

    const amount = parseFloat(formAmount)
    if (isNaN(amount) || amount <= 0) {
      setFormError('Valor invalido')
      return
    }

    const amountCentavos = Math.round(amount * 100)

    const result = await createExpense({
      processoId: formProcessoId,
      category: formCategory,
      description: formDescription.trim(),
      amountCentavos,
      date: formDate,
    })

    if (result) {
      toast.success('Despesa registada')
      setFormProcessoId('')
      setFormCategory(ExpenseCategory.EMOLUMENTOS)
      setFormDescription('')
      setFormAmount('')
      setFormDate(new Date().toISOString().split('T')[0])
      setShowForm(false)
      refetch()
    } else {
      toast.error('Erro ao registar despesa')
    }
  }

  const handleDelete = async (expId: string) => {
    if (!confirm('Tem certeza que deseja eliminar esta despesa?')) return
    const result = await deleteExpenseFn(expId)
    if (result !== null) {
      toast.success('Despesa eliminada')
      refetch()
    } else {
      toast.error('Erro ao eliminar despesa')
    }
  }

  const totalAmount = useMemo(() => {
    if (!expenses) return 0
    return expenses.reduce((sum, expense) => sum + expense.amountCentavos, 0)
  }, [expenses])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const isSocio = session?.role === 'SOCIO_GESTOR'

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink">Despesas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium px-4 sm:px-6 py-2.5  hover:[background:var(--color-btn-primary-hover)] transition-colors min-h-[40px]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Nova Despesa</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      <div className="bg-surface-raised p-5">
        <p className="text-xs font-mono text-ink-muted uppercase mb-2">Total</p>
        <p className="text-3xl font-semibold text-ink">{formatMoney(totalAmount)}</p>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Despesa"
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Processo</label>
              <select
                value={formProcessoId}
                onChange={(e) => setFormProcessoId(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
              >
                <option value="">Seleccionar processo</option>
                {processos?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.processoNumber} — {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">Categoria</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">Descrição</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                required
                placeholder="Descrição da despesa"
                className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">Valor (AKZ)</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                required
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">Data</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
              />
            </div>
          </div>

          {formError && <p className="text-danger text-sm mb-4">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className={cn(
                'px-6 py-2.5 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium',
                'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {creating ? 'A guardar...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-border text-ink font-medium hover:bg-surface-raised transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4" role="alert">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton count={5} label="A carregar despesas" />
      ) : !expenses || expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma despesa"
          description="Comece por registar a sua primeira despesa"
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium  hover:[background:var(--color-btn-primary-hover)] transition-colors min-h-[40px]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Nova Despesa
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {expenses
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((expense) => (
              <div
                key={expense.id}
                className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        href={`/processos/${expense.processo.id}`}
                        className="text-sm font-mono text-ink-muted hover:underline"
                      >
                        {expense.processo.processoNumber}
                      </Link>
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
                          CATEGORY_COLORS[expense.category],
                        )}
                      >
                        {CATEGORY_LABELS[expense.category]}
                      </span>
                    </div>
                    <p className="text-ink mb-1">{expense.description}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-ink">
                        {formatMoney(expense.amountCentavos)}
                      </p>
                      <p className="text-sm text-ink-muted">{formatDate(expense.date)}</p>
                    </div>
                  </div>
                  {isSocio && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <IconButton
                        aria-label="Eliminar despesa"
                        onClick={() => handleDelete(expense.id)}
                        variant="danger"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </IconButton>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
