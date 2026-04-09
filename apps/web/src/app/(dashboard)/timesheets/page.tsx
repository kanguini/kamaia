'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Timer, CheckCircle, X } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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
  [TimeEntryCategory.PESQUISA]: 'bg-info/10 text-info border-info/20',
  [TimeEntryCategory.REDACCAO]: 'bg-amber-50 text-amber-700 border-amber',
  [TimeEntryCategory.AUDIENCIA]: 'bg-error/10 text-error border-error/20',
  [TimeEntryCategory.REUNIAO]: 'bg-success/10 text-success border-success/20',
  [TimeEntryCategory.DESLOCACAO]: 'bg-muted/10 text-muted border-muted/20',
  [TimeEntryCategory.OUTRO]: 'bg-muted/10 text-muted border-muted/20',
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

function TimeEntriesSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-bone rounded-lg p-4 animate-pulse">
          <div className="space-y-3">
            <div className="h-4 bg-border rounded w-3/4" />
            <div className="h-3 bg-border rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TimesheetsPage() {
  const { data: session } = useSession()
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

  const { data: entries, loading, error, refetch } = useApi<TimeEntry[]>(endpoint, [
    processoIdFilter,
    categoryFilter,
    dateFrom,
    dateTo,
  ])

  const { data: summary } = useApi<TimeEntrySummary>('/timesheets/summary')
  const { data: processos } = useApi<Processo[]>('/processos?limit=1000')

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
      setFormProcessoId('')
      setFormCategory(TimeEntryCategory.PESQUISA)
      setFormDate(new Date().toISOString().split('T')[0])
      setFormDuration('')
      setFormDescription('')
      setFormBillable(true)
      refetch()
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm('Tem certeza que deseja eliminar esta entrada?')) return
    const result = await deleteEntryFn(entryId)
    if (result !== null) {
      refetch()
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold text-ink">Timesheets</h1>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-bone rounded-xl p-5">
            <p className="text-xs font-mono text-muted uppercase mb-2">Total esta semana</p>
            <p className="text-2xl font-semibold text-ink">{formatDuration(summary.totalMinutes)}</p>
          </div>
          <div className="bg-bone rounded-xl p-5">
            <p className="text-xs font-mono text-muted uppercase mb-2">Horas facturavel</p>
            <p className="text-2xl font-semibold text-ink">
              {formatDuration(summary.billableMinutes)}
            </p>
          </div>
          <div className="bg-bone rounded-xl p-5">
            <p className="text-xs font-mono text-muted uppercase mb-2">Valor estimado</p>
            <p className="text-2xl font-semibold text-ink">{formatMoney(summary.estimatedValue)}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-bone rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
          <select
            value={formProcessoId}
            onChange={(e) => setFormProcessoId(e.target.value)}
            required
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
          >
            <option value="">Processo</option>
            {processos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.processoNumber}
              </option>
            ))}
          </select>

          <select
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value as TimeEntryCategory)}
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            required
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
          />

          <input
            type="text"
            value={formDuration}
            onChange={(e) => setFormDuration(e.target.value)}
            placeholder="02:30"
            required
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm font-mono"
          />

          <input
            type="text"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Descricao"
            required
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
          />

          <label className="flex items-center gap-2 px-3 py-2 bg-paper border border-border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={formBillable}
              onChange={(e) => setFormBillable(e.target.checked)}
              className="w-4 h-4 text-amber border-border rounded focus:ring-2 focus:ring-amber"
            />
            <span className="text-sm text-ink">Facturaval</span>
          </label>
        </div>

        {formError && (
          <p className="text-error text-sm mb-3">{formError}</p>
        )}

        <button
          type="submit"
          disabled={creating}
          className={cn(
            'px-6 py-2 bg-amber text-ink font-medium rounded-lg',
            'hover:bg-amber-600 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {creating ? 'A guardar...' : 'Guardar'}
        </button>
      </form>

      <div className="bg-bone rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={processoIdFilter}
            onChange={(e) => setProcessoIdFilter(e.target.value)}
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
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
            className="px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
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
              placeholder="De"
              className="flex-1 px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Ate"
              className="flex-1 px-3 py-2 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4">{error}</div>
      )}

      {loading ? (
        <TimeEntriesSkeleton />
      ) : !entries || entries.length === 0 ? (
        <div className="bg-bone rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
            <Timer className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-ink font-medium text-lg mb-2">Nenhum registo de tempo</h3>
          <p className="text-muted text-sm">Comece por registar o seu primeiro timesheet</p>
        </div>
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
                        className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Link
                                href={`/processos/${entry.processo.id}`}
                                className="text-sm font-mono text-muted hover:underline"
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
                            <p className="text-sm font-medium text-amber">
                              {formatDuration(entry.durationMinutes)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 hover:bg-error/10 text-error rounded transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
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
