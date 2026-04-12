'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Clock, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton, FilterTabs, IconButton } from '@/components/ui'
import { PrazoType, PrazoStatus, PaginatedResponse } from '@kamaia/shared-types'

interface Prazo {
  id: string
  title: string
  type: PrazoType
  dueDate: string
  status: PrazoStatus
  isUrgent: boolean
  processo: {
    id: string
    processoNumber: string
    title: string
  }
}

interface PrazoStats {
  urgentes: number
  pendentes: number
  cumpridos: number
}

const PRAZO_TYPE_LABELS: Record<PrazoType, string> = {
  [PrazoType.CONTESTACAO]: 'Contestacao',
  [PrazoType.RECURSO]: 'Recurso',
  [PrazoType.RESPOSTA]: 'Resposta',
  [PrazoType.ALEGACOES]: 'Alegacoes',
  [PrazoType.AUDIENCIA]: 'Audiencia',
  [PrazoType.OUTRO]: 'Outro',
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const diffAbs = Math.abs(diff)

  const minutes = Math.floor(diffAbs / (1000 * 60))
  const hours = Math.floor(diffAbs / (1000 * 60 * 60))
  const days = Math.floor(diffAbs / (1000 * 60 * 60 * 24))

  if (diff < 0) {
    // Past
    if (minutes < 60) return `ha ${minutes} min`
    if (hours < 24) return `ha ${hours} horas`
    return `ha ${days} dias`
  } else {
    // Future
    if (minutes < 60) return `em ${minutes} min`
    if (hours < 24) return `em ${hours} horas`
    return `em ${days} dias`
  }
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date.toDateString() === tomorrow.toDateString()
}

function isThisWeek(date: Date): boolean {
  const now = new Date()
  const weekFromNow = new Date()
  weekFromNow.setDate(now.getDate() + 7)
  return date > now && date <= weekFromNow
}

export default function PrazosPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [search, setSearch] = useState<string>('')

  const hasActiveFilters = search !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || urgentOnly

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('ALL')
    setTypeFilter('ALL')
    setUrgentOnly(false)
  }

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.append('status', statusFilter)
    if (typeFilter !== 'ALL') params.append('type', typeFilter)
    if (urgentOnly) params.append('urgentOnly', 'true')
    return `/prazos?${params.toString()}`
  }, [statusFilter, typeFilter, urgentOnly])

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Prazo>>(endpoint, [
    statusFilter,
    typeFilter,
    urgentOnly,
  ])

  const { mutate: completePrazo } = useMutation(`/prazos/ID/complete`, 'PATCH')

  const handleComplete = async () => {
    const result = await completePrazo(undefined)
    if (result !== null) {
      refetch()
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: PrazoStatus) => {
    const styles = {
      [PrazoStatus.PENDENTE]: 'bg-amber-50 text-ink-700 border-amber',
      [PrazoStatus.CUMPRIDO]: 'bg-green-50 text-green-700 border-success',
      [PrazoStatus.EXPIRADO]: 'bg-red-50 text-red-700 border-danger',
      [PrazoStatus.CANCELADO]: 'bg-muted/10 text-ink-muted border-muted/20',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
          styles[status],
        )}
      >
        {status}
      </span>
    )
  }

  // Calculate stats
  const stats: PrazoStats = useMemo(() => {
    if (!data?.data) return { urgentes: 0, pendentes: 0, cumpridos: 0 }

    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return {
      urgentes: data.data.filter(p => p.status === PrazoStatus.PENDENTE && p.isUrgent).length,
      pendentes: data.data.filter(p => p.status === PrazoStatus.PENDENTE).length,
      cumpridos: data.data.filter(p =>
        p.status === PrazoStatus.CUMPRIDO && new Date(p.dueDate) >= thisMonth
      ).length,
    }
  }, [data])

  // Group prazos by proximity for PENDENTES view
  const groupedPrazos = useMemo(() => {
    if (!data?.data) return {}
    if (statusFilter !== 'ALL' && statusFilter !== PrazoStatus.PENDENTE) {
      return { all: data.data }
    }

    const pendentes = data.data.filter(p => p.status === PrazoStatus.PENDENTE)
    const now = new Date()

    const groups: Record<string, Prazo[]> = {
      atrasados: [],
      hoje: [],
      amanha: [],
      estaSemana: [],
      proximo: [],
    }

    pendentes.forEach(prazo => {
      const dueDate = new Date(prazo.dueDate)

      if (dueDate < now) {
        groups.atrasados.push(prazo)
      } else if (isToday(dueDate)) {
        groups.hoje.push(prazo)
      } else if (isTomorrow(dueDate)) {
        groups.amanha.push(prazo)
      } else if (isThisWeek(dueDate)) {
        groups.estaSemana.push(prazo)
      } else {
        groups.proximo.push(prazo)
      }
    })

    return groups
  }, [data, statusFilter])

  const showGrouped = statusFilter === 'ALL' || statusFilter === PrazoStatus.PENDENTE

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink">Prazos</h1>
        <Link
          href="/prazos/novo"
          className="flex items-center gap-2 bg-white text-[#070707] font-medium px-4 sm:px-6 py-2.5  hover:bg-white/90 transition-colors min-h-[40px]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Novo Prazo</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-danger/10 border border-danger/20 ">
          <span className="text-xs font-mono text-danger">{stats.urgentes} urgentes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber ">
          <span className="text-xs font-mono text-ink-700">{stats.pendentes} pendentes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-success ">
          <span className="text-xs font-mono text-green-700">{stats.cumpridos} cumpridos este mes</span>
        </div>
      </div>

      <div className="bg-surface-raised p-4 space-y-4">
        <FilterTabs
          value={statusFilter}
          onChange={setStatusFilter}
          label="Filtrar por status"
          tabs={[
            { value: 'ALL', label: 'Todos' },
            { value: PrazoStatus.PENDENTE, label: 'Pendentes' },
            { value: PrazoStatus.CUMPRIDO, label: 'Cumpridos' },
            { value: PrazoStatus.EXPIRADO, label: 'Expirados' },
            { value: PrazoStatus.CANCELADO, label: 'Cancelados' },
          ]}
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder="Pesquisar prazos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar prazos"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar por tipo"
            className="px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent font-mono text-sm min-h-[40px]"
          >
            <option value="ALL">Todos os Tipos</option>
            {Object.entries(PRAZO_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border  cursor-pointer hover:bg-surface-raised transition-colors">
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
              aria-label="Apenas urgentes"
              className="w-4 h-4 text-ink border-border rounded focus:ring-2 focus:ring-ink"
            />
            <span className="text-sm font-medium text-ink">Apenas urgentes</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4" role="alert">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton count={5} label="A carregar prazos" />
      ) : !data || data.data.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Nenhum prazo corresponde aos filtros aplicados"
            action={
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#070707] font-medium  hover:bg-white/90 transition-colors min-h-[40px]"
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="Nenhum prazo"
            description="Comece por criar o seu primeiro prazo"
            action={
              <Link href="/prazos/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#070707] font-medium  hover:bg-white/90 transition-colors min-h-[40px]">
                <Plus className="w-4 h-4" aria-hidden="true" />
                Novo Prazo
              </Link>
            }
          />
        )
      ) : showGrouped ? (
        <div className="space-y-6">
          {groupedPrazos.atrasados && groupedPrazos.atrasados.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-danger mb-3">Atrasados</h2>
              <div className="space-y-3">
                {groupedPrazos.atrasados.map((prazo) => (
                  <div
                    key={prazo.id}
                    className="bg-danger/5 border-l-4 border-danger  p-4 hover:bg-danger/10 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-label="Urgente" />}
                      <div className="flex-1 min-w-0">
                        <Link href={`/prazos/${prazo.id}`} className="block">
                          <h3 className="font-semibold text-ink mb-1 hover:text-ink transition-colors">{prazo.title}</h3>
                        </Link>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          className="text-sm font-mono text-ink-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-ink-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-danger mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-ink-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <IconButton
                            aria-label="Marcar como cumprido"
                            onClick={handleComplete}
                            variant="default"
                            size="sm"
                            className="mt-2 !w-auto !h-auto px-2 py-1 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="ml-1 text-xs">Cumprido</span>
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedPrazos.hoje && groupedPrazos.hoje.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-warning mb-3">Hoje</h2>
              <div className="space-y-3">
                {groupedPrazos.hoje.map((prazo) => (
                  <div
                    key={prazo.id}
                    className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-label="Urgente" />}
                      <div className="flex-1 min-w-0">
                        <Link href={`/prazos/${prazo.id}`} className="block">
                          <h3 className="font-semibold text-ink mb-1 hover:text-ink transition-colors">{prazo.title}</h3>
                        </Link>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          className="text-sm font-mono text-ink-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-ink-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-warning mb-1">Hoje</p>
                        <p className="text-xs text-ink-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <IconButton
                            aria-label="Marcar como cumprido"
                            onClick={handleComplete}
                            variant="default"
                            size="sm"
                            className="mt-2 !w-auto !h-auto px-2 py-1 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="ml-1 text-xs">Cumprido</span>
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedPrazos.amanha && groupedPrazos.amanha.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink mb-3">Amanha</h2>
              <div className="space-y-3">
                {groupedPrazos.amanha.map((prazo) => (
                  <div
                    key={prazo.id}
                    className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-label="Urgente" />}
                      <div className="flex-1 min-w-0">
                        <Link href={`/prazos/${prazo.id}`} className="block">
                          <h3 className="font-semibold text-ink mb-1 hover:text-ink transition-colors">{prazo.title}</h3>
                        </Link>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          className="text-sm font-mono text-ink-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-ink-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-ink mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-ink-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <IconButton
                            aria-label="Marcar como cumprido"
                            onClick={handleComplete}
                            variant="default"
                            size="sm"
                            className="mt-2 !w-auto !h-auto px-2 py-1 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="ml-1 text-xs">Cumprido</span>
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedPrazos.estaSemana && groupedPrazos.estaSemana.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink mb-3">Esta Semana</h2>
              <div className="space-y-3">
                {groupedPrazos.estaSemana.map((prazo) => (
                  <div
                    key={prazo.id}
                    className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-label="Urgente" />}
                      <div className="flex-1 min-w-0">
                        <Link href={`/prazos/${prazo.id}`} className="block">
                          <h3 className="font-semibold text-ink mb-1 hover:text-ink transition-colors">{prazo.title}</h3>
                        </Link>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          className="text-sm font-mono text-ink-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-ink-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-ink mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-ink-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <IconButton
                            aria-label="Marcar como cumprido"
                            onClick={handleComplete}
                            variant="default"
                            size="sm"
                            className="mt-2 !w-auto !h-auto px-2 py-1 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="ml-1 text-xs">Cumprido</span>
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedPrazos.proximo && groupedPrazos.proximo.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink mb-3">Proximo</h2>
              <div className="space-y-3">
                {groupedPrazos.proximo.map((prazo) => (
                  <div
                    key={prazo.id}
                    className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-label="Urgente" />}
                      <div className="flex-1 min-w-0">
                        <Link href={`/prazos/${prazo.id}`} className="block">
                          <h3 className="font-semibold text-ink mb-1 hover:text-ink transition-colors">{prazo.title}</h3>
                        </Link>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          className="text-sm font-mono text-ink-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-ink-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-ink mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-ink-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <IconButton
                            aria-label="Marcar como cumprido"
                            onClick={handleComplete}
                            variant="default"
                            size="sm"
                            className="mt-2 !w-auto !h-auto px-2 py-1 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="ml-1 text-xs">Cumprido</span>
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((prazo) => (
            <Link
              key={prazo.id}
              href={`/prazos/${prazo.id}`}
              className="block bg-surface border border-border p-4 hover:bg-surface-raised/80 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <div className="flex items-start gap-3">
                {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                  <Link
                    href={`/processos/${prazo.processo.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-mono text-ink-muted hover:underline"
                  >
                    {prazo.processo.processoNumber}
                  </Link>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-muted/10 text-ink-muted rounded-full">
                      {PRAZO_TYPE_LABELS[prazo.type]}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-ink-muted mb-2">{formatDate(prazo.dueDate)}</p>
                  {getStatusBadge(prazo.status)}
                </div>
              </div>
            </Link>
          ))}

          {data.nextCursor && (
            <div className="flex justify-center pt-4">
              <button className="px-6 py-2.5 border border-border  text-sm font-medium text-ink-muted hover:bg-surface-raised transition-colors">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
