'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
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

function PrazoSkeleton() {
  return (
    <div className="bg-bone rounded-lg p-4 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-border rounded w-3/4" />
        <div className="h-3 bg-border rounded w-1/2" />
        <div className="h-5 bg-border rounded w-24" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-bone rounded-xl p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
        <Clock className="w-8 h-8 text-muted" />
      </div>
      <h3 className="text-ink font-medium text-lg mb-2">Nenhum prazo registado</h3>
      <p className="text-muted text-sm mb-6">Comece por criar o seu primeiro prazo</p>
      <Link
        href="/prazos/novo"
        className="inline-flex items-center gap-2 bg-amber text-ink font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Novo Prazo
      </Link>
    </div>
  )
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
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [urgentOnly, setUrgentOnly] = useState(false)

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
      [PrazoStatus.PENDENTE]: 'bg-amber-50 text-amber-700 border-amber',
      [PrazoStatus.CUMPRIDO]: 'bg-green-50 text-green-700 border-success',
      [PrazoStatus.EXPIRADO]: 'bg-red-50 text-red-700 border-error',
      [PrazoStatus.CANCELADO]: 'bg-muted/10 text-muted border-muted/20',
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold text-ink">Prazos</h1>
        <Link
          href="/prazos/novo"
          className="flex items-center gap-2 bg-amber text-ink font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Prazo
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-error/10 border border-error/20 rounded-lg">
          <span className="text-xs font-mono text-error">{stats.urgentes} urgentes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber rounded-lg">
          <span className="text-xs font-mono text-amber-700">{stats.pendentes} pendentes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-success rounded-lg">
          <span className="text-xs font-mono text-green-700">{stats.cumpridos} cumpridos este mes</span>
        </div>
      </div>

      <div className="bg-bone rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === 'ALL'
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter(PrazoStatus.PENDENTE)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === PrazoStatus.PENDENTE
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Pendentes
          </button>
          <button
            onClick={() => setStatusFilter(PrazoStatus.CUMPRIDO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === PrazoStatus.CUMPRIDO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Cumpridos
          </button>
          <button
            onClick={() => setStatusFilter(PrazoStatus.EXPIRADO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === PrazoStatus.EXPIRADO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Expirados
          </button>
          <button
            onClick={() => setStatusFilter(PrazoStatus.CANCELADO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === PrazoStatus.CANCELADO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Cancelados
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent font-mono text-sm"
          >
            <option value="ALL">Todos os Tipos</option>
            {Object.entries(PRAZO_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-paper border border-border rounded-lg cursor-pointer hover:bg-bone transition-colors">
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
              className="w-4 h-4 text-amber border-border rounded focus:ring-2 focus:ring-amber"
            />
            <span className="text-sm font-medium text-ink">Apenas urgentes</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <PrazoSkeleton key={i} />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState />
      ) : showGrouped ? (
        <div className="space-y-6">
          {groupedPrazos.atrasados && groupedPrazos.atrasados.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-error mb-3">Atrasados</h2>
              <div className="space-y-3">
                {groupedPrazos.atrasados.map((prazo) => (
                  <div
                    key={prazo.id}
                    onClick={() => router.push(`/prazos/${prazo.id}`)}
                    className="bg-error/5 border-l-4 border-error rounded-lg p-4 hover:bg-error/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-mono text-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-error mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleComplete()
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-success hover:text-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Cumprido
                          </button>
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
                    onClick={() => router.push(`/prazos/${prazo.id}`)}
                    className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-mono text-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-warning mb-1">Hoje</p>
                        <p className="text-xs text-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleComplete()
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-success hover:text-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Cumprido
                          </button>
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
                    onClick={() => router.push(`/prazos/${prazo.id}`)}
                    className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-mono text-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-ink mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleComplete()
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-success hover:text-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Cumprido
                          </button>
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
                    onClick={() => router.push(`/prazos/${prazo.id}`)}
                    className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-mono text-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-ink mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleComplete()
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-success hover:text-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Cumprido
                          </button>
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
                    onClick={() => router.push(`/prazos/${prazo.id}`)}
                    className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                        <Link
                          href={`/processos/${prazo.processo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-mono text-muted hover:underline"
                        >
                          {prazo.processo.processoNumber}
                        </Link>
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                            {PRAZO_TYPE_LABELS[prazo.type]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-ink mb-1">
                          {getRelativeTime(new Date(prazo.dueDate))}
                        </p>
                        <p className="text-xs text-muted mb-2">{formatDate(prazo.dueDate)}</p>
                        {getStatusBadge(prazo.status)}
                        {prazo.status === PrazoStatus.PENDENTE && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleComplete()
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-success hover:text-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Cumprido
                          </button>
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
            <div
              key={prazo.id}
              onClick={() => router.push(`/prazos/${prazo.id}`)}
              className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {prazo.isUrgent && <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink mb-1">{prazo.title}</h3>
                  <Link
                    href={`/processos/${prazo.processo.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-mono text-muted hover:underline"
                  >
                    {prazo.processo.processoNumber}
                  </Link>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-muted/10 text-muted rounded-full">
                      {PRAZO_TYPE_LABELS[prazo.type]}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted mb-2">{formatDate(prazo.dueDate)}</p>
                  {getStatusBadge(prazo.status)}
                </div>
              </div>
            </div>
          ))}

          {data.nextCursor && (
            <div className="flex justify-center pt-4">
              <button className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-bone transition-colors">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
