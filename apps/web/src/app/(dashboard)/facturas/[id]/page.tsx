'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Download, Send, Ban, Check, Loader2,
  Circle,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  paidAt: string
  method: string | null
  reference: string | null
}
interface Item {
  id: string
  kind: 'TIME' | 'EXPENSE' | 'CUSTOM'
  description: string
  quantity: number
  unitPrice: number
  total: number
}
interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string | null
  status:
    | 'DRAFT'
    | 'SENT'
    | 'PAID'
    | 'PARTIALLY_PAID'
    | 'OVERDUE'
    | 'VOID'
  currency: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  notes: string | null
  termsText: string | null
  cliente: { id: string; name: string; nif: string | null; email: string | null }
  processo: { id: string; processoNumber: string; title: string } | null
  items: Item[]
  payments: Payment[]
  createdBy: { firstName: string; lastName: string }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-ink-muted bg-surface-raised',
  SENT: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300',
  PAID: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300',
  PARTIALLY_PAID: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300',
  OVERDUE: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300',
  VOID: 'text-ink-muted bg-surface line-through',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviada',
  PAID: 'Paga',
  PARTIALLY_PAID: 'Parcial',
  OVERDUE: 'Vencida',
  VOID: 'Anulada',
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { data: session } = useSession()
  const toast = useToast()
  const { data: invoice, refetch } = useApi<Invoice>(`/invoices/${id}`)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paidAt: new Date().toISOString().slice(0, 10),
    method: 'TRANSFERENCIA' as const,
    reference: '',
    notes: '',
  })
  const [working, setWorking] = useState(false)

  if (!invoice) {
    return <div className="p-6 text-ink-muted">A carregar...</div>
  }

  const outstanding = invoice.total - invoice.amountPaid

  const send = async () => {
    if (!session?.accessToken) return
    setWorking(true)
    try {
      await api(`/invoices/${id}/send`, {
        method: 'POST',
        token: session.accessToken,
      })
      toast.success('Factura marcada como enviada')
      refetch()
    } catch (e: unknown) {
      toast.error((e as { error?: string })?.error || 'Erro')
    } finally {
      setWorking(false)
    }
  }

  const voidInvoice = async () => {
    if (!session?.accessToken) return
    if (!confirm('Anular esta factura? As entradas voltam a ficar disponíveis.')) return
    setWorking(true)
    try {
      await api(`/invoices/${id}/void`, {
        method: 'POST',
        token: session.accessToken,
      })
      toast.success('Factura anulada')
      refetch()
    } catch (e: unknown) {
      toast.error((e as { error?: string })?.error || 'Erro')
    } finally {
      setWorking(false)
    }
  }

  const exportPdf = async () => {
    if (!session?.accessToken) return
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    const res = await fetch(`${apiBase}/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (!res.ok) {
      toast.error('Erro ao gerar PDF')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `factura-${invoice.number.replace('/', '-')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const recordPayment = async () => {
    if (!session?.accessToken) return
    const amount = Math.round(parseFloat(paymentForm.amount) * 100)
    if (!amount || amount <= 0) {
      toast.error('Indique um valor válido')
      return
    }
    setWorking(true)
    try {
      await api(`/invoices/${id}/payments`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          amount,
          paidAt: new Date(paymentForm.paidAt).toISOString(),
          method: paymentForm.method,
          reference: paymentForm.reference || undefined,
          notes: paymentForm.notes || undefined,
        }),
      })
      toast.success('Pagamento registado')
      setShowPayment(false)
      setPaymentForm({
        amount: '',
        paidAt: new Date().toISOString().slice(0, 10),
        method: 'TRANSFERENCIA',
        reference: '',
        notes: '',
      })
      refetch()
    } catch (e: unknown) {
      toast.error((e as { error?: string })?.error || 'Erro')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/facturas" className="p-2 border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <p className="text-xs font-mono text-ink-muted">Factura</p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {invoice.number}
          </h1>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded',
            STATUS_COLORS[invoice.status],
          )}
        >
          <Circle className="w-1.5 h-1.5 fill-current" />
          {STATUS_LABELS[invoice.status]}
        </span>
      </header>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-raised"
        >
          <Download className="w-4 h-4" />
          PDF
        </button>
        {invoice.status === 'DRAFT' && (
          <button
            onClick={send}
            disabled={working}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-ink text-surface rounded-lg disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Marcar enviada
          </button>
        )}
        {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
          <button
            onClick={() => setShowPayment(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg"
          >
            <Check className="w-4 h-4" />
            Registar pagamento
          </button>
        )}
        {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
          <button
            onClick={voidInvoice}
            disabled={working}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-border rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 ml-auto"
          >
            <Ban className="w-4 h-4" />
            Anular
          </button>
        )}
      </div>

      {/* Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-raised p-4 md:col-span-2">
          <p className="text-[10px] font-mono uppercase text-ink-muted mb-1">Cliente</p>
          <p className="text-sm font-medium text-ink">{invoice.cliente.name}</p>
          {invoice.cliente.nif && (
            <p className="text-xs text-ink-muted">NIF: {invoice.cliente.nif}</p>
          )}
          {invoice.cliente.email && (
            <p className="text-xs text-ink-muted">{invoice.cliente.email}</p>
          )}
          {invoice.processo && (
            <p className="text-xs text-ink-muted mt-2">
              Processo: {invoice.processo.processoNumber} · {invoice.processo.title}
            </p>
          )}
        </div>
        <div className="bg-surface-raised p-4">
          <p className="text-[10px] font-mono uppercase text-ink-muted">Datas</p>
          <p className="text-xs text-ink">
            Emissão: {new Date(invoice.issueDate).toLocaleDateString('pt-AO')}
          </p>
          {invoice.dueDate && (
            <p className="text-xs text-ink">
              Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-AO')}
            </p>
          )}
        </div>
      </section>

      {/* Items */}
      <section className="bg-surface border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised">
            <tr className="text-ink-muted text-xs">
              <th className="text-left px-4 py-2">Descrição</th>
              <th className="text-right px-4 py-2">Qtd</th>
              <th className="text-right px-4 py-2">Preço unit.</th>
              <th className="text-right px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-4 py-2 text-ink">
                  {it.description}
                  <span className="ml-2 text-[10px] font-mono text-ink-muted">
                    {it.kind}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {Number(it.quantity).toLocaleString('pt-AO', {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-right font-mono text-ink-muted">
                  {(it.unitPrice / 100).toLocaleString('pt-AO')}
                </td>
                <td className="px-4 py-2 text-right font-mono text-ink">
                  {(it.total / 100).toLocaleString('pt-AO')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={3} className="px-4 py-2 text-right text-xs text-ink-muted">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right font-mono text-ink">
                {(invoice.subtotal / 100).toLocaleString('pt-AO')} {invoice.currency}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="px-4 py-1 text-right text-xs text-ink-muted">
                IVA ({invoice.taxRate}%)
              </td>
              <td className="px-4 py-1 text-right font-mono text-ink-muted">
                {(invoice.taxAmount / 100).toLocaleString('pt-AO')}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td colSpan={3} className="px-4 py-2 text-right text-sm font-semibold">
                TOTAL
              </td>
              <td className="px-4 py-2 text-right font-mono font-semibold text-ink">
                {(invoice.total / 100).toLocaleString('pt-AO')} {invoice.currency}
              </td>
            </tr>
            {invoice.amountPaid > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="px-4 py-1 text-right text-xs text-ink-muted">
                    Pago
                  </td>
                  <td className="px-4 py-1 text-right font-mono text-emerald-600">
                    {(invoice.amountPaid / 100).toLocaleString('pt-AO')}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-1 text-right text-xs text-ink-muted">
                    Em dívida
                  </td>
                  <td
                    className={cn(
                      'px-4 py-1 text-right font-mono',
                      outstanding > 0 ? 'text-red-600' : 'text-ink',
                    )}
                  >
                    {(outstanding / 100).toLocaleString('pt-AO')}
                  </td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </section>

      {/* Payments history */}
      {invoice.payments.length > 0 && (
        <section className="bg-surface-raised p-4">
          <h3 className="text-sm font-medium text-ink mb-2">
            Histórico de pagamentos
          </h3>
          <div className="space-y-2">
            {invoice.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs bg-surface border border-border px-3 py-2"
              >
                <div>
                  <p className="text-ink font-mono">
                    {(p.amount / 100).toLocaleString('pt-AO')} AOA
                  </p>
                  <p className="text-ink-muted">
                    {new Date(p.paidAt).toLocaleDateString('pt-AO')}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {(invoice.notes || invoice.termsText) && (
        <section className="bg-surface-raised p-4 space-y-3">
          {invoice.notes && (
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted">Notas</p>
              <p className="text-sm text-ink whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.termsText && (
            <div>
              <p className="text-[10px] font-mono uppercase text-ink-muted">
                Termos & Condições
              </p>
              <p className="text-sm text-ink whitespace-pre-wrap">{invoice.termsText}</p>
            </div>
          )}
        </section>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !working && setShowPayment(false)}
        >
          <div
            className="bg-surface border border-border rounded-lg w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-ink">Registar pagamento</h2>
            <p className="text-xs text-ink-muted">
              Em dívida: {(outstanding / 100).toLocaleString('pt-AO')} AOA
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-ink mb-1">
                  Valor (AOA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-ink mb-1">Data</label>
                <input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink mb-1">Método</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) =>
                    setPaymentForm((f) => ({
                      ...f,
                      method: e.target.value as typeof paymentForm.method,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                >
                  <option>TRANSFERENCIA</option>
                  <option>DINHEIRO</option>
                  <option>CHEQUE</option>
                  <option>OUTRO</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink mb-1">
                  Referência (opcional)
                </label>
                <input
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, reference: e.target.value }))
                  }
                  placeholder="Ex: TRF-2026-0042"
                  className="w-full px-3 py-2 text-sm bg-surface border border-border"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPayment(false)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={recordPayment}
                disabled={working}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg disabled:opacity-50"
              >
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Registar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
