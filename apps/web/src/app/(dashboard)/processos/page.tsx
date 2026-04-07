'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Scale, AlertCircle } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import {
  ProcessoType,
  ProcessoStatus,
  ProcessoPriority,
  PaginatedResponse,
} from '@kamaia/shared-types'

interface Processo {
  id: string
  processoNumber: string
  title: string
  type: ProcessoType
  status: ProcessoStatus
  priority: ProcessoPriority
  currentStage: string
  createdAt: string
  cliente: {
    id: string
    name: string
  }
  prazos?: {
    dueDate: string
  }[]
}

const PROCESSO_TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Civel',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Familia',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}

function ProcessoSkeleton() {
  return (
    <div className="bg-bone rounded-lg p-4 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-border rounded w-1/4" />
        <div className="h-6 bg-border rounded w-3/4" />
        <div className="flex gap-2">
          <div className="h-5 bg-border rounded w-20" />
          <div className="h-5 bg-border rounded w-20" />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-bone rounded-xl p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
        <Scale className="w-8 h-8 text-muted" />
      </div>
      <h3 className="text-ink font-medium text-lg mb-2">Nenhum processo encontrado</h3>
      <p className="text-muted text-sm mb-6">Comece por criar o seu primeiro processo</p>
      <Link
        href="/processos/novo"
        className="inline-flex items-center gap-2 bg-amber text-ink font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Novo Processo
      </Link>
    </div>
  )
}

export default function ProcessosPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.append('status', statusFilter)
    if (typeFilter !== 'ALL') params.append('type', typeFilter)
    if (priorityFilter !== 'ALL') params.append('priority', priorityFilter)
    return `/processos?${params.toString()}`
  }, [statusFilter, typeFilter, priorityFilter])

  const { data, loading, error } = useApi<PaginatedResponse<Processo>>(endpoint, [
    statusFilter,
    typeFilter,
    priorityFilter,
  ])

  const getStatusBadge = (status: ProcessoStatus) => {
    const styles = {
      [ProcessoStatus.ACTIVO]: 'bg-success/10 text-success border-success/20',
      [ProcessoStatus.SUSPENSO]: 'bg-warning/10 text-warning border-warning/20',
      [ProcessoStatus.ENCERRADO]: 'bg-muted/10 text-muted border-muted/20',
      [ProcessoStatus.ARQUIVADO]: 'bg-ink/10 text-ink border-ink/20',
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

  const getPriorityBadge = (priority: ProcessoPriority) => {
    const styles = {
      [ProcessoPriority.ALTA]: 'bg-error/10 text-error border-error/20',
      [ProcessoPriority.MEDIA]: 'bg-warning/10 text-warning border-warning/20',
      [ProcessoPriority.BAIXA]: 'bg-muted/10 text-muted border-muted/20',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
          styles[priority],
        )}
      >
        {priority}
      </span>
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const hasUrgentDeadline = (processo: Processo) => {
    if (!processo.prazos || processo.prazos.length === 0) return false
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    return processo.prazos.some((prazo) => {
      const dueDate = new Date(prazo.dueDate)
      return dueDate <= threeDaysFromNow && dueDate >= now
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold text-ink">Processos</h1>
        <Link
          href="/processos/novo"
          className="flex items-center gap-2 bg-amber text-ink font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Processo
        </Link>
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
            onClick={() => setStatusFilter(ProcessoStatus.ACTIVO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === ProcessoStatus.ACTIVO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Activos
          </button>
          <button
            onClick={() => setStatusFilter(ProcessoStatus.SUSPENSO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === ProcessoStatus.SUSPENSO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Suspensos
          </button>
          <button
            onClick={() => setStatusFilter(ProcessoStatus.ENCERRADO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === ProcessoStatus.ENCERRADO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Encerrados
          </button>
          <button
            onClick={() => setStatusFilter(ProcessoStatus.ARQUIVADO)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === ProcessoStatus.ARQUIVADO
                ? 'bg-amber text-ink'
                : 'bg-paper text-muted hover:bg-border',
            )}
          >
            Arquivados
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent font-mono text-sm"
          >
            <option value="ALL">Todos os Tipos</option>
            {Object.entries(PROCESSO_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent font-mono text-sm"
          >
            <option value="ALL">Todas as Prioridades</option>
            <option value={ProcessoPriority.ALTA}>Alta</option>
            <option value={ProcessoPriority.MEDIA}>Media</option>
            <option value={ProcessoPriority.BAIXA}>Baixa</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <ProcessoSkeleton key={i} />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {data.data.map((processo) => (
            <div
              key={processo.id}
              onClick={() => router.push(`/processos/${processo.id}`)}
              className={cn(
                'bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer',
                hasUrgentDeadline(processo) && 'border-l-4 border-error',
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-muted">
                      {processo.processoNumber}
                    </span>
                    {hasUrgentDeadline(processo) && (
                      <AlertCircle className="w-4 h-4 text-error" />
                    )}
                  </div>
                  <h3 className="font-medium text-ink mb-1">{processo.title}</h3>
                  <p className="text-sm text-muted">{processo.cliente.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-info/10 text-info rounded-full border border-info/20">
                    {PROCESSO_TYPE_LABELS[processo.type]}
                  </span>
                  {getStatusBadge(processo.status)}
                  {getPriorityBadge(processo.priority)}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted mb-1">{formatDate(processo.createdAt)}</p>
                  <p className="text-xs font-mono text-ink">{processo.currentStage}</p>
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
