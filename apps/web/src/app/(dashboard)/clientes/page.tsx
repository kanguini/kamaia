'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, User, Building2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { ClienteType, PaginatedResponse } from '@kamaia/shared-types'

interface Cliente {
  id: string
  name: string
  type: ClienteType
  nif: string | null
  email: string | null
  phone: string | null
  _count?: {
    processos: number
  }
}

function ClienteSkeleton() {
  return (
    <div className="bg-bone rounded-lg p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-border rounded w-1/3" />
          <div className="h-4 bg-border rounded w-1/4" />
        </div>
        <div className="h-4 bg-border rounded w-16" />
      </div>
    </div>
  )
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="bg-bone rounded-xl p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
        <User className="w-8 h-8 text-muted" />
      </div>
      <h3 className="text-ink font-medium text-lg mb-2">Nenhum cliente encontrado</h3>
      <p className="text-muted text-sm mb-6">
        {type === 'search'
          ? 'Tente ajustar os filtros de pesquisa'
          : 'Comece por adicionar o seu primeiro cliente'}
      </p>
      {type !== 'search' && (
        <Link
          href="/clientes/novo"
          className="inline-flex items-center gap-2 bg-amber text-ink font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Link>
      )}
    </div>
  )
}

export default function ClientesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.append('search', debouncedSearch)
    if (typeFilter !== 'ALL') params.append('type', typeFilter)
    return `/clientes?${params.toString()}`
  }, [debouncedSearch, typeFilter])

  const { data, loading, error } = useApi<PaginatedResponse<Cliente>>(endpoint, [
    debouncedSearch,
    typeFilter,
  ])

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    const timeout = setTimeout(() => setDebouncedSearch(value), 300)
    return () => clearTimeout(timeout)
  }, [])

  const getTypeBadge = (type: ClienteType) => {
    const styles = {
      [ClienteType.INDIVIDUAL]:
        'bg-info/10 text-info border-info/20',
      [ClienteType.EMPRESA]: 'bg-amber/10 text-amber border-amber/20',
    }
    const icons = {
      [ClienteType.INDIVIDUAL]: User,
      [ClienteType.EMPRESA]: Building2,
    }
    const labels = {
      [ClienteType.INDIVIDUAL]: 'Individual',
      [ClienteType.EMPRESA]: 'Empresa',
    }
    const Icon = icons[type]
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full border',
          styles[type],
        )}
      >
        <Icon className="w-3 h-3" />
        {labels[type]}
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold text-ink">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-2 bg-amber text-ink font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Link>
      </div>

      <div className="bg-bone rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Pesquisar por nome, NIF, email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-paper border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent font-mono text-sm"
          >
            <option value="ALL">Todos</option>
            <option value={ClienteType.INDIVIDUAL}>Individual</option>
            <option value={ClienteType.EMPRESA}>Empresa</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <ClienteSkeleton key={i} />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState type={debouncedSearch || typeFilter !== 'ALL' ? 'search' : 'empty'} />
      ) : (
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-mono text-muted uppercase">
            <div className="col-span-3">Nome</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">NIF</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Telefone</div>
            <div className="col-span-1 text-right">Processos</div>
          </div>

          {data.data.map((cliente) => (
            <div
              key={cliente.id}
              onClick={() => router.push(`/clientes/${cliente.id}`)}
              className="bg-bone rounded-lg p-4 hover:bg-bone/80 transition-colors cursor-pointer"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
                <div className="md:col-span-3">
                  <p className="font-medium text-ink">{cliente.name}</p>
                </div>
                <div className="md:col-span-2">{getTypeBadge(cliente.type)}</div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted font-mono">{cliente.nif || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted truncate">{cliente.email || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted font-mono">{cliente.phone || '—'}</p>
                </div>
                <div className="md:col-span-1 text-left md:text-right">
                  <span className="inline-flex items-center justify-center px-2 py-1 bg-ink text-bone text-xs font-mono rounded">
                    {cliente._count?.processos || 0}
                  </span>
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
