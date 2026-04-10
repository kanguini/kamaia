'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Scale, AlertCircle, Search } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton, FilterTabs } from '@/components/ui'
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

export default function ProcessosPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [search, setSearch] = useState<string>('')

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.append('status', statusFilter)
    if (typeFilter !== 'ALL') params.append('type', typeFilter)
    if (priorityFilter !== 'ALL') params.append('priority', priorityFilter)
    if (search) params.append('search', search)
    return `/processos?${params.toString()}`
  }, [statusFilter, typeFilter, priorityFilter, search])

  const { data, loading, error } = useApi<PaginatedResponse<Processo>>(endpoint, [
    statusFilter,
    typeFilter,
    priorityFilter,
    search,
  ])

  const hasActiveFilters = search !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || priorityFilter !== 'ALL'

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('ALL')
    setTypeFilter('ALL')
    setPriorityFilter('ALL')
  }

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
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink">Processos</h1>
        <Link
          href="/processos/novo"
          className="flex items-center gap-2 bg-amber text-ink font-medium px-4 sm:px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors min-h-[40px]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Novo Processo</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      <div className="bg-bone rounded-xl p-4 space-y-4">
        <FilterTabs
          value={statusFilter}
          onChange={setStatusFilter}
          label="Filtrar por status"
          tabs={[
            { value: 'ALL', label: 'Todos' },
            { value: ProcessoStatus.ACTIVO, label: 'Activos' },
            { value: ProcessoStatus.SUSPENSO, label: 'Suspensos' },
            { value: ProcessoStatus.ENCERRADO, label: 'Encerrados' },
            { value: ProcessoStatus.ARQUIVADO, label: 'Arquivados' },
          ]}
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder="Pesquisar processos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar processos"
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar por tipo"
            className="px-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent font-mono text-sm min-h-[40px]"
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
            aria-label="Filtrar por prioridade"
            className="px-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent font-mono text-sm min-h-[40px]"
          >
            <option value="ALL">Todas as Prioridades</option>
            <option value={ProcessoPriority.ALTA}>Alta</option>
            <option value={ProcessoPriority.MEDIA}>Media</option>
            <option value={ProcessoPriority.BAIXA}>Baixa</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4" role="alert">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton count={5} label="A carregar processos" />
      ) : !data || data.data.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Nenhum processo corresponde aos filtros aplicados"
            action={
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-bone font-medium rounded-lg hover:bg-ink/90 transition-colors min-h-[40px]"
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Scale}
            title="Nenhum processo"
            description="Comece por criar o seu primeiro processo"
            action={
              <Link href="/processos/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-amber text-ink font-medium rounded-lg hover:bg-amber-600 transition-colors min-h-[40px]">
                <Plus className="w-4 h-4" aria-hidden="true" />
                Novo Processo
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {data.data.map((processo) => (
            <Link
              key={processo.id}
              href={`/processos/${processo.id}`}
              className={cn(
                'block bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors',
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
            </Link>
          ))}

          {data.nextCursor && (
            <div className="flex justify-center pt-4">
              <button className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-bone transition-colors min-h-[40px]">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
