'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'

interface ClienteOption {
  id: string
  name: string
  nif: string | null
}
interface TimeEntryRow {
  id: string
  date: string
  category: string
  description: string | null
  durationMinutes: number
  hourlyRate: number | null
  processo: { id: string; processoNumber: string; title: string; feeAmount: number | null }
  user: { id: string; firstName: string; lastName: string }
}
interface ExpenseRow {
  id: string
  date: string
  category: string
  description: string
  amount: number
  processo: { id: string; processoNumber: string; title: string }
}
interface Draft {
  timeEntries: TimeEntryRow[]
  expenses: ExpenseRow[]
  processos: { id: string; processoNumber: string; title: string; feeAmount: number | null }[]
}

export default function NewInvoicePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const toast = useToast()

  const { data: clientesData } = useApi<{ data: ClienteOption[] }>(
    '/clientes?limit=200',
  )
  const clientes = clientesData?.data ?? []

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [form, setForm] = useState({
    clienteId: '',
    dateFrom: firstOfMonth.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
    taxRate: 14,
    defaultHourlyRate: '',
    dueDate: '',
    notes: '',
    termsText: '',
  })

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [selectedTimeIds, setSelectedTimeIds] = useState<Set<string>>(new Set())
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set())
  const [customItems, setCustomItems] = useState<
    { description: string; quantity: number; unitPrice: number }[]
  >([])
  const [submitting, setSubmitting] = useState(false)

  // Preview draft whenever cliente or date range changes
  useEffect(() => {
    if (!form.clienteId || !session?.accessToken) {
      setDraft(null)
      return
    }
    setLoadingDraft(true)
    api<{ data: Draft }>('/invoices/preview-draft', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({
        clienteId: form.clienteId,
        dateFrom: new Date(form.dateFrom).toISOString(),
        dateTo: new Date(form.dateTo + 'T23:59:59').toISOString(),
        defaultHourlyRate: form.defaultHourlyRate
          ? parseInt(form.defaultHourlyRate, 10) * 100
          : undefined,
      }),
    })
      .then((res) => {
        setDraft(res.data)
        // select all by default
        setSelectedTimeIds(new Set(res.data.timeEntries.map((t) => t.id)))
        setSelectedExpenseIds(new Set(res.data.expenses.map((e) => e.id)))
      })
      .catch(() => setDraft(null))
      .finally(() => setLoadingDraft(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clienteId, form.dateFrom, form.dateTo, form.defaultHourlyRate, session?.accessToken])

  // ── Computed totals ────────────────────────────────────
  const rateForEntry = (t: TimeEntryRow): number =>
    t.hourlyRate ??
    t.processo.feeAmount ??
    (form.defaultHourlyRate ? parseInt(form.defaultHourlyRate, 10) * 100 : 0)

  const timeSubtotal = draft
    ? draft.timeEntries
        .filter((t) => selectedTimeIds.has(t.id))
        .reduce((s, t) => s + Math.round((t.durationMinutes / 60) * rateForEntry(t)), 0)
    : 0
  const expenseSubtotal = draft
    ? draft.expenses
        .filter((e) => selectedExpenseIds.has(e.id))
        .reduce((s, e) => s + e.amount, 0)
    : 0
  const customSubtotal = customItems.reduce(
    (s, c) => s + Math.round(c.quantity * c.unitPrice * 100),
    0,
  )
  const subtotal = timeSubtotal + expenseSubtotal + customSubtotal
  const tax = Math.round((subtotal * form.taxRate) / 100)
  const total = subtotal + tax

  const toggleTime = (id: string) => {
    setSelectedTimeIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const toggleExpense = (id: string) => {
    setSelectedExpenseIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const emit = async () => {
    if (!session?.accessToken) return
    if (!form.clienteId) {
      toast.error('Seleccione um cliente')
      return
    }
    if (
      selectedTimeIds.size === 0 &&
      selectedExpenseIds.size === 0 &&
      customItems.length === 0
    ) {
      toast.error('Seleccione pelo menos uma entrada ou adicione item')
      return
    }
    setSubmitting(true)
    try {
      const created = await api<{ data: { id: string } }>('/invoices', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          clienteId: form.clienteId,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
          taxRate: form.taxRate,
          notes: form.notes || undefined,
          termsText: form.termsText || undefined,
          timeEntryIds: Array.from(selectedTimeIds),
          expenseIds: Array.from(selectedExpenseIds),
          customItems: customItems.map((c) => ({
            ...c,
            unitPrice: Math.round(c.unitPrice * 100),
          })),
          defaultHourlyRate: form.defaultHourlyRate
            ? parseInt(form.defaultHourlyRate, 10) * 100
            : undefined,
        }),
      })
      toast.success('Factura criada em rascunho')
      router.push(`/facturas/${created.data.id}`)
    } catch (e: unknown) {
      const msg = (e as { error?: string })?.error || 'Erro ao criar factura'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/facturas" className="p-2 border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">Nova factura</h1>
      </header>

      {/* Filters */}
      <div className="bg-surface-raised p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Cliente</label>
          <select
            value={form.clienteId}
            onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-surface border border-border"
          >
            <option value="">— Seleccionar —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.nif ? ` · ${c.nif}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1">De</label>
          <input
            type="date"
            value={form.dateFrom}
            onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-surface border border-border"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1">Até</label>
          <input
            type="date"
            value={form.dateTo}
            onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-surface border border-border"
          />
        </div>
      </div>

      {/* Billable entries */}
      {!form.clienteId ? (
        <div className="text-center py-12 text-sm text-ink-muted bg-surface-raised">
          Seleccione um cliente para ver entradas facturáveis.
        </div>
      ) : loadingDraft ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
        </div>
      ) : draft ? (
        <>
          {/* Time entries */}
          <section className="bg-surface border border-border">
            <header className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">
                Timesheets facturáveis ({draft.timeEntries.length})
              </h2>
              <label className="text-xs text-ink-muted flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    draft.timeEntries.length > 0 &&
                    selectedTimeIds.size === draft.timeEntries.length
                  }
                  onChange={(e) =>
                    setSelectedTimeIds(
                      e.target.checked
                        ? new Set(draft.timeEntries.map((t) => t.id))
                        : new Set(),
                    )
                  }
                />
                Todos
              </label>
            </header>
            {draft.timeEntries.length === 0 ? (
              <p className="text-center text-xs text-ink-muted py-6">
                Sem timesheets facturáveis neste período.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-surface-raised">
                  <tr className="text-ink-muted">
                    <th className="text-left px-3 py-1.5 w-6"></th>
                    <th className="text-left px-3 py-1.5">Data</th>
                    <th className="text-left px-3 py-1.5">Processo</th>
                    <th className="text-left px-3 py-1.5">Descrição</th>
                    <th className="text-right px-3 py-1.5">Horas</th>
                    <th className="text-right px-3 py-1.5">Taxa/h</th>
                    <th className="text-right px-3 py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.timeEntries.map((t) => {
                    const hours = t.durationMinutes / 60
                    const rate = rateForEntry(t)
                    return (
                      <tr key={t.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={selectedTimeIds.has(t.id)}
                            onChange={() => toggleTime(t.id)}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-ink-muted">
                          {new Date(t.date).toLocaleDateString('pt-AO')}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-ink-muted">
                          {t.processo.processoNumber}
                        </td>
                        <td className="px-3 py-1.5 text-ink">
                          {t.description || t.category}
                          <span className="text-ink-muted text-[10px]">
                            {' · '}
                            {t.user.firstName}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {hours.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink-muted">
                          {(rate / 100).toLocaleString('pt-AO')}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink">
                          {(Math.round(hours * rate) / 100).toLocaleString('pt-AO')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* Expenses */}
          <section className="bg-surface border border-border">
            <header className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">
                Despesas ({draft.expenses.length})
              </h2>
              <label className="text-xs text-ink-muted flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    draft.expenses.length > 0 &&
                    selectedExpenseIds.size === draft.expenses.length
                  }
                  onChange={(e) =>
                    setSelectedExpenseIds(
                      e.target.checked
                        ? new Set(draft.expenses.map((x) => x.id))
                        : new Set(),
                    )
                  }
                />
                Todas
              </label>
            </header>
            {draft.expenses.length === 0 ? (
              <p className="text-center text-xs text-ink-muted py-6">
                Sem despesas neste período.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-surface-raised">
                  <tr className="text-ink-muted">
                    <th className="text-left px-3 py-1.5 w-6"></th>
                    <th className="text-left px-3 py-1.5">Data</th>
                    <th className="text-left px-3 py-1.5">Processo</th>
                    <th className="text-left px-3 py-1.5">Descrição</th>
                    <th className="text-right px-3 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.expenses.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.has(e.id)}
                          onChange={() => toggleExpense(e.id)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-ink-muted">
                        {new Date(e.date).toLocaleDateString('pt-AO')}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-ink-muted">
                        {e.processo.processoNumber}
                      </td>
                      <td className="px-3 py-1.5 text-ink">{e.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">
                        {(e.amount / 100).toLocaleString('pt-AO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Custom items */}
          <section className="bg-surface border border-border p-4 space-y-3">
            <h2 className="text-sm font-medium text-ink">Itens livres</h2>
            {customItems.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  placeholder="Descrição"
                  value={c.description}
                  onChange={(e) =>
                    setCustomItems((cs) =>
                      cs.map((x, idx) =>
                        idx === i ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                  className="col-span-7 px-3 py-1.5 text-sm bg-surface border border-border"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Qtd"
                  value={c.quantity || ''}
                  onChange={(e) =>
                    setCustomItems((cs) =>
                      cs.map((x, idx) =>
                        idx === i
                          ? { ...x, quantity: parseFloat(e.target.value) || 0 }
                          : x,
                      ),
                    )
                  }
                  className="col-span-2 px-3 py-1.5 text-sm bg-surface border border-border"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Preço unit. (AKZ)"
                  value={c.unitPrice || ''}
                  onChange={(e) =>
                    setCustomItems((cs) =>
                      cs.map((x, idx) =>
                        idx === i
                          ? { ...x, unitPrice: parseFloat(e.target.value) || 0 }
                          : x,
                      ),
                    )
                  }
                  className="col-span-2 px-3 py-1.5 text-sm bg-surface border border-border"
                />
                <button
                  onClick={() =>
                    setCustomItems((cs) => cs.filter((_, idx) => idx !== i))
                  }
                  className="col-span-1 text-xs text-red-600"
                >
                  remover
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setCustomItems((cs) => [
                  ...cs,
                  { description: '', quantity: 1, unitPrice: 0 },
                ])
              }
              className="text-xs text-ink-muted hover:text-ink"
            >
              + adicionar item
            </button>
          </section>

          {/* Summary + emit */}
          <section className="bg-surface-raised p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3 md:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">IVA (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step="0.5"
                    value={form.taxRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 text-sm bg-surface border border-border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Taxa horária por defeito (AKZ, para entradas sem taxa definida)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 15000"
                  value={form.defaultHourlyRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, defaultHourlyRate: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Notas</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Termos & Condições
                </label>
                <textarea
                  rows={2}
                  value={form.termsText}
                  onChange={(e) => setForm((f) => ({ ...f, termsText: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                />
              </div>
            </div>

            <aside className="bg-surface p-4 space-y-1">
              <p className="text-[10px] font-mono uppercase text-ink-muted">Subtotal</p>
              <p className="text-sm font-semibold text-ink mb-2">
                {(subtotal / 100).toLocaleString('pt-AO')} AKZ
              </p>
              <p className="text-[10px] font-mono uppercase text-ink-muted">
                IVA ({form.taxRate}%)
              </p>
              <p className="text-sm text-ink mb-2">
                {(tax / 100).toLocaleString('pt-AO')} AKZ
              </p>
              <p className="text-[10px] font-mono uppercase text-ink-muted">Total</p>
              <p className="text-2xl font-semibold text-ink">
                {(total / 100).toLocaleString('pt-AO')} AKZ
              </p>
              <button
                onClick={emit}
                disabled={submitting || total <= 0}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-ink text-surface rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Criar rascunho
              </button>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  )
}
