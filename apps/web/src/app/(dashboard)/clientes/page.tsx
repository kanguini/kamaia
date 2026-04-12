'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, User, Building2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton } from '@/components/ui'
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

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const hasActiveFilters = debouncedSearch !== '' || typeFilter !== 'ALL'

  const clearFilters = () => {
    setSearchQuery('')
    setDebouncedSearch('')
    setTypeFilter('ALL')
  }

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
      [ClienteType.INDIVIDUAL]: 'bg-info-bg text-info-text',
      [ClienteType.EMPRESA]: 'bg-surface-raised text-ink-muted border border-border',
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
          'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono',
          styles[type],
        )}
      >
        <Icon className="w-3 h-3" />
        {labels[type]}
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-2 bg-ink text-white font-medium px-4 sm:px-6 py-2.5 hover:bg-[#1a1a1a] transition-colors min-h-[40px]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Novo Cliente</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      <div className="bg-surface-raised p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder="Pesquisar por nome, NIF, email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              aria-label="Pesquisar clientes"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar por tipo de cliente"
            className="px-4 py-2.5 bg-surface border border-border-strong focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent font-mono text-sm min-h-[40px]"
          >
            <option value="ALL">Todos</option>
            <option value={ClienteType.INDIVIDUAL}>Individual</option>
            <option value={ClienteType.EMPRESA}>Empresa</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger/20 text-danger p-4" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={5} label="A carregar clientes" />
      ) : !data || data.data.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Nenhum cliente corresponde aos filtros aplicados"
            action={
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white font-medium hover:bg-[#1a1a1a] transition-colors min-h-[40px]"
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={User}
            title="Nenhum cliente"
            description="Comece por adicionar o seu primeiro cliente"
            action={
              <Link href="/clientes/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white font-medium  hover:bg-[#1a1a1a] transition-colors min-h-[40px]">
                <Plus className="w-4 h-4" aria-hidden="true" />
                Novo Cliente
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase text-ink-ghost bg-surface-raised">
            <div className="col-span-3">Nome</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">NIF</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Telefone</div>
            <div className="col-span-1 text-right">Processos</div>
          </div>

          {data.data.map((cliente) => (
            <Link
              key={cliente.id}
              href={`/clientes/${cliente.id}`}
              className="block bg-surface border border-border p-4 hover:bg-surface-hover transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
                <div className="md:col-span-3">
                  <p className="font-medium text-ink">{cliente.name}</p>
                </div>
                <div className="md:col-span-2">{getTypeBadge(cliente.type)}</div>
                <div className="md:col-span-2">
                  <p className="text-sm text-ink-muted font-mono">{cliente.nif || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-ink-muted truncate">{cliente.email || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-ink-muted font-mono">{cliente.phone || '—'}</p>
                </div>
                <div className="md:col-span-1 text-left md:text-right">
                  <span className="inline-flex items-center justify-center px-2 py-1 bg-ink text-white text-xs font-mono">
                    {cliente._count?.processos || 0}
                  </span>
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
    </div>
  )
}
