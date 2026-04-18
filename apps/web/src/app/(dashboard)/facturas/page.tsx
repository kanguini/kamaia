'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, Circle } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton } from '@/components/ui'

type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'VOID'

interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string | null
  status: InvoiceStatus
  total: number
  amountPaid: number
  currency: string
  cliente: { id: string; name: string; nif: string | null }
  processo: { id: string; processoNumber: string; title: string } | null
  _count?: { items: number; payments: number }
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviada',
  PAID: 'Paga',
  PARTIALLY_PAID: 'Parcial',
  OVERDUE: 'Vencida',
  VOID: 'Anulada',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'text-ink-muted bg-surface-raised',
  SENT: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300',
  PAID: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300',
  PARTIALLY_PAID: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300',
  OVERDUE: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300',
  VOID: 'text-ink-muted bg-surface line-through',
}

export default function InvoicesListPage() {
  const [status, setStatus] = useState<'ALL' | InvoiceStatus>('ALL')
  const qs = new URLSearchParams()
  if (status !== 'ALL') qs.set('status', status)

  const { data, loading } = useApi<{ data: Invoice[] }>(
    `/invoices?${qs.toString()}`,
    [status],
  )
  const invoices = data?.data || []

  // KPIs
  const totalBilled = invoices
    .filter((i) => i.status !== 'VOID' && i.status !== 'DRAFT')
    .reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0)
  const totalOutstanding = invoices
    .filter((i) => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
    .reduce((s, i) => s + (i.total - i.amountPaid), 0)

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink">
            Facturas
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Agrega timesheets facturáveis + despesas em facturas emitidas.
          </p>
        </div>
        <Link
          href="/facturas/nova"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nova factura
        </Link>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-raised p-5">
          <p className="text-[10px] font-mono uppercase text-ink-muted mb-1">
            Facturado (emitido)
          </p>
          <p className="text-2xl font-semibold text-ink">
            {(totalBilled / 100).toLocaleString('pt-AO')} AKZ
          </p>
        </div>
        <div className="bg-surface-raised p-5">
          <p className="text-[10px] font-mono uppercase text-ink-muted mb-1">Recebido</p>
          <p className="text-2xl font-semibold text-ink">
            {(totalPaid / 100).toLocaleString('pt-AO')} AKZ
          </p>
        </div>
        <div className="bg-surface-raised p-5">
          <p className="text-[10px] font-mono uppercase text-ink-muted mb-1">Em dívida</p>
          <p
            className={cn(
              'text-2xl font-semibold',
              totalOutstanding > 0 ? 'text-red-600' : 'text-ink',
            )}
          >
            {(totalOutstanding / 100).toLocaleString('pt-AO')} AKZ
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ALL' | InvoiceStatus)}
          className="px-3 py-1.5 text-sm bg-surface border border-border"
        >
          <option value="ALL">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} label="A carregar facturas" />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sem facturas"
          description="Agregue trabalho facturável numa nova factura."
        />
      ) : (
        <div className="bg-surface border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-ink-muted">Nº</th>
                <th className="text-left px-4 py-2 font-medium text-ink-muted">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-ink-muted">Emissão</th>
                <th className="text-left px-4 py-2 font-medium text-ink-muted">Vence</th>
                <th className="text-right px-4 py-2 font-medium text-ink-muted">Total</th>
                <th className="text-right px-4 py-2 font-medium text-ink-muted">Pago</th>
                <th className="text-left px-4 py-2 font-medium text-ink-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const isOverdue =
                  i.dueDate &&
                  new Date(i.dueDate) < new Date() &&
                  !['PAID', 'VOID'].includes(i.status)
                return (
                  <tr
                    key={i.id}
                    className="border-b border-border hover:bg-surface-raised"
                  >
                    <td className="px-4 py-2 font-mono text-ink">
                      <Link href={`/facturas/${i.id}`} className="hover:underline">
                        {i.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-ink">{i.cliente.name}</p>
                      {i.processo && (
                        <p className="text-xs font-mono text-ink-muted">
                          {i.processo.processoNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-ink-muted">
                      {new Date(i.issueDate).toLocaleDateString('pt-AO')}
                    </td>
                    <td className="px-4 py-2">
                      {i.dueDate ? (
                        <span className={isOverdue ? 'text-red-600' : 'text-ink-muted'}>
                          {new Date(i.dueDate).toLocaleDateString('pt-AO')}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-ink">
                      {(i.total / 100).toLocaleString('pt-AO')}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-ink-muted">
                      {(i.amountPaid / 100).toLocaleString('pt-AO')}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded',
                          STATUS_COLORS[i.status],
                        )}
                      >
                        <Circle className="w-1.5 h-1.5 fill-current" />
                        {STATUS_LABELS[i.status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
