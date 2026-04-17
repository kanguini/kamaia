'use client'

import { useState, useMemo, lazy, Suspense } from 'react'
import Link from 'next/link'
import { Scale, AlertCircle, Search, LayoutList, Columns3 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton, FilterTabs } from '@/components/ui'

const KanbanView = lazy(() => import('./kanban-view'))
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
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
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
      [ProcessoStatus.ACTIVO]: 'bg-success-bg text-success-text',
      [ProcessoStatus.SUSPENSO]: 'bg-warning-bg text-warning-text',
      [ProcessoStatus.ENCERRADO]: 'bg-surface-raised text-ink-muted border border-border',
      [ProcessoStatus.ARQUIVADO]: '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono',
          styles[status],
        )}
      >
        <span className="w-[5px] h-[5px] bg-current" />
        {status}
      </span>
    )
  }

  const getPriorityBadge = (priority: ProcessoPriority) => {
    const styles = {
      [ProcessoPriority.ALTA]: 'bg-danger-bg text-danger-text',
      [ProcessoPriority.MEDIA]: 'bg-warning-bg text-warning-text',
      [ProcessoPriority.BAIXA]: 'bg-surface-raised text-ink-muted border border-border',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono',
          styles[priority],
        )}
      >
        <span className="w-[5px] h-[5px] bg-current" />
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
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-surface-raised border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink',
              )}
              aria-label="Vista lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'kanban' ? 'bg-ink text-surface' : 'text-ink-muted hover:text-ink',
              )}
              aria-label="Vista kanban"
            >
              <Columns3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <Suspense fallback={<div className="flex gap-4">{[1,2,3].map(i => <div key={i} className="min-w-[260px] h-[300px] bg-surface-raised rounded-lg animate-pulse" />)}</div>}>
          <KanbanView />
        </Suspense>
      ) : (
      <>
      <div className="bg-surface-raised p-4 space-y-4">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder="Pesquisar processos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar processos"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar por tipo"
            className="px-4 py-2.5 bg-surface border border-border-strong focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent font-mono text-sm min-h-[40px]"
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
            className="px-4 py-2.5 bg-surface border border-border-strong focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent font-mono text-sm min-h-[40px]"
          >
            <option value="ALL">Todas as Prioridades</option>
            <option value={ProcessoPriority.ALTA}>Alta</option>
            <option value={ProcessoPriority.MEDIA}>Media</option>
            <option value={ProcessoPriority.BAIXA}>Baixa</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger/20 text-danger p-4" role="alert">{error}</div>
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
                className="inline-flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium hover:[background:var(--color-btn-primary-hover)] transition-colors min-h-[40px]"
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Scale}
            title="Nenhum processo"
            description="Use o botão + Novo no topo para criar o seu primeiro processo"
          />
        )
      ) : (
        <div className="space-y-3">
          {data.data.map((processo) => (
            <Link
              key={processo.id}
              href={`/processos/${processo.id}`}
              className={cn(
                'block bg-surface border border-border p-4 hover:bg-surface-hover transition-colors',
                hasUrgentDeadline(processo) && 'border-l-4 border-danger',
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-ink-muted">
                      {processo.processoNumber}
                    </span>
                    {hasUrgentDeadline(processo) && (
                      <AlertCircle className="w-4 h-4 text-danger" />
                    )}
                  </div>
                  <h3 className="font-medium text-ink mb-1">{processo.title}</h3>
                  <p className="text-sm text-ink-muted">{processo.cliente.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 bg-info-bg text-info-text">
                    <span className="w-[5px] h-[5px] bg-current" />
                    {PROCESSO_TYPE_LABELS[processo.type]}
                  </span>
                  {getStatusBadge(processo.status)}
                  {getPriorityBadge(processo.priority)}
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-muted mb-1">{formatDate(processo.createdAt)}</p>
                  <p className="text-xs font-mono text-ink">{processo.currentStage}</p>
                </div>
              </div>
            </Link>
          ))}

          {data.nextCursor && (
            <div className="flex justify-center pt-4">
              <button className="px-6 py-2.5 border border-border text-sm font-medium text-ink-muted hover:bg-surface-raised transition-colors min-h-[40px]">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}
