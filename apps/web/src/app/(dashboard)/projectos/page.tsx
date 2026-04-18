'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Briefcase, Plus, Circle } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton } from '@/components/ui'
import {
  ProjectCategory,
  ProjectStatus,
  PROJECT_CATEGORY_LABELS,
} from '@kamaia/shared-types'

interface Project {
  id: string
  code: string
  name: string
  category: ProjectCategory
  status: ProjectStatus
  healthStatus: 'GREEN' | 'YELLOW' | 'RED'
  endDate: string | null
  cliente?: { id: string; name: string } | null
  manager?: { id: string; firstName: string; lastName: string }
  _count?: { processos: number; milestones: number; members: number }
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PROPOSTA]: 'Proposta',
  [ProjectStatus.ACTIVO]: 'Activo',
  [ProjectStatus.EM_PAUSA]: 'Em pausa',
  [ProjectStatus.CONCLUIDO]: 'Concluído',
  [ProjectStatus.CANCELADO]: 'Cancelado',
}

const HEALTH_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-600',
  YELLOW: 'text-amber-600',
  RED: 'text-red-600',
}

export default function ProjectsListPage() {
  const [category, setCategory] = useState<'ALL' | ProjectCategory>('ALL')
  const [status, setStatus] = useState<'ALL' | ProjectStatus>('ALL')

  const qs = new URLSearchParams()
  if (category !== 'ALL') qs.set('category', category)
  if (status !== 'ALL') qs.set('status', status)

  const { data, loading } = useApi<{ data: Project[] }>(
    `/projects?${qs.toString()}`,
    [category, status],
  )
  const projects = data?.data || []

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink">
            Projectos
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Gestão de projectos jurídicos — litígio, M&A, Compliance, Due Diligence e mais.
          </p>
        </div>
        <Link
          href="/projectos/novo"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Projecto
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'ALL' | ProjectCategory)}
          className="px-3 py-1.5 text-sm bg-surface border border-border"
        >
          <option value="ALL">Todas as categorias</option>
          {Object.entries(PROJECT_CATEGORY_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ALL' | ProjectStatus)}
          className="px-3 py-1.5 text-sm bg-surface border border-border"
        >
          <option value="ALL">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} label="A carregar projectos" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum projecto"
          description="Crie o primeiro projecto jurídico do gabinete."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projectos/${p.id}`}
              className="block bg-surface border border-border p-4 hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-mono text-ink-muted">{p.code}</span>
                <Circle
                  className={cn('w-3 h-3 fill-current', HEALTH_COLORS[p.healthStatus])}
                  aria-label={`Saúde: ${p.healthStatus}`}
                />
              </div>
              <h3 className="text-sm font-medium text-ink line-clamp-2 mb-2">{p.name}</h3>
              <p className="text-xs text-ink-muted">
                {PROJECT_CATEGORY_LABELS[p.category]}
                {p.cliente ? ` · ${p.cliente.name}` : ''}
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-ink-muted">
                <span>{p._count?.processos ?? 0} proc.</span>
                <span>{p._count?.milestones ?? 0} marcos</span>
                <span>{p._count?.members ?? 0} membros</span>
                <span className="ml-auto px-1.5 py-0.5 bg-surface-raised rounded text-[10px] font-mono">
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
