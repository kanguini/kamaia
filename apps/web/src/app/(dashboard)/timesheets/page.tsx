'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Timer, CheckCircle, X } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton, IconButton, FormField } from '@/components/ui'
import { TimeEntryCategory } from '@kamaia/shared-types'
import { useSession } from 'next-auth/react'

interface TimeEntry {
  id: string
  durationMinutes: number
  description: string
  date: string
  category: TimeEntryCategory
  billable: boolean
  processo: {
    id: string
    processoNumber: string
    title: string
  }
}

interface TimeEntrySummary {
  totalMinutes: number
  billableMinutes: number
  estimatedValue: number
}

interface Processo {
  id: string
  processoNumber: string
  title: string
}

const CATEGORY_LABELS: Record<TimeEntryCategory, string> = {
  [TimeEntryCategory.PESQUISA]: 'Pesquisa',
  [TimeEntryCategory.REDACCAO]: 'Redaccao',
  [TimeEntryCategory.AUDIENCIA]: 'Audiencia',
  [TimeEntryCategory.REUNIAO]: 'Reuniao',
  [TimeEntryCategory.DESLOCACAO]: 'Deslocacao',
  [TimeEntryCategory.OUTRO]: 'Outro',
}

const CATEGORY_COLORS: Record<TimeEntryCategory, string> = {
  [TimeEntryCategory.PESQUISA]: 'bg-info-bg text-info-text border-info',
  [TimeEntryCategory.REDACCAO]: 'bg-warning-bg text-warning-text border-warning',
  [TimeEntryCategory.AUDIENCIA]: 'bg-danger-bg text-danger-text border-danger',
  [TimeEntryCategory.REUNIAO]: 'bg-success-bg text-success-text border-success',
  [TimeEntryCategory.DESLOCACAO]: 'bg-surface-raised text-ink-muted border-border',
  [TimeEntryCategory.OUTRO]: 'bg-surface-raised text-ink-muted border-border',
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function formatMoney(centavos: number): string {
  return `${(centavos / 100).toLocaleString('pt-AO')} AKZ`
}

export default function TimesheetsPage() {
  const { data: session } = useSession()
  const toast = useToast()
  const [processoIdFilter, setProcessoIdFilter] = useState<string>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  const [formProcessoId, setFormProcessoId] = useState<string>('')
  const [formCategory, setFormCategory] = useState<TimeEntryCategory>(TimeEntryCategory.PESQUISA)
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formDuration, setFormDuration] = useState<string>('')
  const [formDescription, setFormDescription] = useState<string>('')
  const [formBillable, setFormBillable] = useState<boolean>(true)
  const [formError, setFormError] = useState<string>('')

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (processoIdFilter !== 'ALL') params.append('processoId', processoIdFilter)
    if (categoryFilter !== 'ALL') params.append('category', categoryFilter)
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    return `/timesheets?${params.toString()}`
  }, [processoIdFilter, categoryFilter, dateFrom, dateTo])

  const { data: entriesData, loading, error, refetch } = useApi<{ data: TimeEntry[]; total: number }>(endpoint, [
    processoIdFilter,
    categoryFilter,
    dateFrom,
    dateTo,
  ])

  const entries = entriesData?.data || []

  const { data: summary } = useApi<TimeEntrySummary>('/timesheets/summary')
  const { data: processosData } = useApi<{ data: Processo[] }>('/processos?limit=1000')
  const processos = processosData?.data || []

  const { mutate: createEntry, loading: creating } = useMutation<{
    processoId: string
    category: TimeEntryCategory
    date: string
    durationMinutes: number
    description: string
    billable: boolean
  }>('/timesheets', 'POST')

  const deleteEntryFn = async (entryId: string) => {
    if (!session?.accessToken) return null
    try {
      await api(`/timesheets/${entryId}`, { method: 'DELETE', token: session.accessToken })
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

    const durationMinutes = parseDuration(formDuration)
    if (!durationMinutes || durationMinutes <= 0) {
      setFormError('Duracao invalida (formato: HH:MM)')
      return
    }

    if (!formDescription.trim()) {
      setFormError('Descricao e obrigatoria')
      return
    }

    const result = await createEntry({
      processoId: formProcessoId,
      category: formCategory,
      date: formDate,
      durationMinutes,
      description: formDescription.trim(),
      billable: formBillable,
    })

    if (result) {
      toast.success('Entrada registada')
      setFormProcessoId('')
      setFormCategory(TimeEntryCategory.PESQUISA)
      setFormDate(new Date().toISOString().split('T')[0])
      setFormDuration('')
      setFormDescription('')
      setFormBillable(true)
      refetch()
    } else {
      toast.error('Erro ao registar entrada')
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm('Tem certeza que deseja eliminar esta entrada?')) return
    const result = await deleteEntryFn(entryId)
    if (result !== null) {
      toast.success('Entrada eliminada')
      refetch()
    } else {
      toast.error('Erro ao eliminar entrada')
    }
  }

  const groupedEntries = useMemo(() => {
    if (!entries) return {}

    const groups: Record<string, TimeEntry[]> = {}
    entries.forEach((entry) => {
      const date = new Date(entry.date).toISOString().split('T')[0]
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    })

    return groups
  }, [entries])

  const formatGroupDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const weekday = date.toLocaleDateString('pt-AO', { weekday: 'long' })
    const formatted = date.toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatted}`
  }

  const calculateGroupTotal = (entries: TimeEntry[]): number => {
    return entries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink">Timesheets</h1>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-raised p-5">
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Total esta semana</p>
            <p className="text-2xl font-semibold text-ink">{formatDuration(summary.totalMinutes)}</p>
          </div>
          <div className="bg-surface-raised p-5">
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Horas facturavel</p>
            <p className="text-2xl font-semibold text-ink">
              {formatDuration(summary.billableMinutes)}
            </p>
          </div>
          <div className="bg-surface-raised p-5">
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Valor estimado</p>
            <p className="text-2xl font-semibold text-ink">{formatMoney(summary.estimatedValue)}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface-raised p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
          <FormField label="Processo" required>
            <select
              value={formProcessoId}
              onChange={(e) => setFormProcessoId(e.target.value)}
              required
              aria-label="Seleccionar processo"
              className="w-full px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
            >
              <option value="">Seleccionar</option>
              {processos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.processoNumber}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Categoria" required>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as TimeEntryCategory)}
              aria-label="Categoria"
              className="w-full px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Data" required>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              aria-label="Data"
              className="w-full px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
            />
          </FormField>

          <FormField label="Duracao" required hint="Formato: HH:MM">
            <input
              type="text"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              placeholder="02:30"
              required
              aria-label="Duracao"
              className="w-full px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm font-mono min-h-[40px]"
            />
          </FormField>

          <FormField label="Descricao" required>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Descricao"
              required
              aria-label="Descricao"
              className="w-full px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
            />
          </FormField>

          <FormField label="Facturavel">
            <label className="flex items-center gap-2 px-3 py-2 bg-surface border border-border  cursor-pointer min-h-[40px]">
              <input
                type="checkbox"
                checked={formBillable}
                onChange={(e) => setFormBillable(e.target.checked)}
                aria-label="Facturavel"
                className="w-4 h-4 text-ink border-border rounded focus:ring-2 focus:ring-ink"
              />
              <span className="text-sm text-ink">Sim</span>
            </label>
          </FormField>
        </div>

        {formError && (
          <p className="text-danger text-sm mb-3">{formError}</p>
        )}

        <button
          type="submit"
          disabled={creating}
          className={cn(
            'px-6 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium ',
            'hover:[background:var(--color-btn-primary-hover)] transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {creating ? 'A guardar...' : 'Guardar'}
        </button>
      </form>

      <div className="bg-surface-raised p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={processoIdFilter}
            onChange={(e) => setProcessoIdFilter(e.target.value)}
            aria-label="Filtrar por processo"
            className="px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
          >
            <option value="ALL">Todos os Processos</option>
            {processos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.processoNumber}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoria"
            className="px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
          >
            <option value="ALL">Todas as Categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Data de inicio"
              className="flex-1 px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Data de fim"
              className="flex-1 px-3 py-2 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent text-sm min-h-[40px]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4" role="alert">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton count={5} label="A carregar timesheets" />
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="Nenhum registo de tempo"
          description="Comece por registar o seu primeiro timesheet"
        />
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedEntries)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map((dateStr) => {
              const dayEntries = groupedEntries[dateStr]
              const totalMinutes = calculateGroupTotal(dayEntries)

              return (
                <div key={dateStr}>
                  <h2 className="font-display text-xl font-semibold text-ink mb-3">
                    {formatGroupDate(dateStr)} — {formatDuration(totalMinutes)}
                  </h2>
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Link
                                href={`/processos/${entry.processo.id}`}
                                className="text-sm font-mono text-ink-muted hover:underline"
                              >
                                {entry.processo.processoNumber}
                              </Link>
                              <span
                                className={cn(
                                  'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
                                  CATEGORY_COLORS[entry.category],
                                )}
                              >
                                {CATEGORY_LABELS[entry.category]}
                              </span>
                              {entry.billable && (
                                <CheckCircle className="w-4 h-4 text-success" />
                              )}
                            </div>
                            <p className="text-ink mb-1">{entry.description}</p>
                            <p className="text-sm font-medium text-ink">
                              {formatDuration(entry.durationMinutes)}
                            </p>
                          </div>
                          <IconButton
                            aria-label="Eliminar entrada"
                            onClick={() => handleDelete(entry.id)}
                            variant="danger"
                            size="sm"
                          >
                            <X className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
