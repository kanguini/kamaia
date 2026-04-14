'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Scale, Clock, Users, Bot, AlertCircle, CheckCircle, AlertTriangle, FileDown } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { PrazoStatus } from '@kamaia/shared-types'

interface DashboardStats {
  activeProcessos: number
  upcomingPrazos: number
  activeClientes: number
  aiQueriesRemaining: number
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  loading?: boolean
}

function StatCard({ title, value, loading }: StatCardProps) {
  return (
    <div className="bg-surface-raised p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <p className="text-[11px] text-ink-muted">{title}</p>
        {loading ? (
          <div className="h-9 w-16 bg-border animate-pulse" />
        ) : (
          <p className="font-display text-[28px] text-ink">{value}</p>
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-surface-raised p-8 text-center">
      <div className="w-12 h-12 bg-ink-muted/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6 text-ink-muted" />
      </div>
      <h3 className="text-ink font-medium mb-1">{title}</h3>
      <p className="text-ink-muted text-sm">{description}</p>
    </div>
  )
}

interface UpcomingPrazo {
  id: string
  title: string
  dueDate: string
  isUrgent: boolean
  status: PrazoStatus
  processo: {
    id: string
    processoNumber: string
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const diffAbs = Math.abs(diff)

  const hours = Math.floor(diffAbs / (1000 * 60 * 60))
  const days = Math.floor(diffAbs / (1000 * 60 * 60 * 24))

  if (diff < 0) {
    if (hours < 24) return `ha ${hours} horas`
    return `ha ${days} dias`
  } else {
    if (hours < 24) return `em ${hours} horas`
    return `em ${days} dias`
  }
}

function ProximosPrazosSection() {
  const { data: prazosData, loading, refetch } = useApi<{ upcoming: UpcomingPrazo[]; overdue: UpcomingPrazo[] }>('/prazos/upcoming')
  const prazos = [...(prazosData?.upcoming || []), ...(prazosData?.overdue || [])]
  const { mutate: completePrazo } = useMutation('/prazos/ID/complete', 'PATCH')

  const handleComplete = async () => {
    const result = await completePrazo(undefined)
    if (result !== null) {
      refetch()
    }
  }

  return (
    <div>
      <h2 className="font-display text-[20px] font-medium text-ink mb-4">Proximos Prazos</h2>
      {loading ? (
        <div className="bg-surface-raised p-6 space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-border" />
          ))}
        </div>
      ) : !prazos || prazos.length === 0 ? (
        <EmptyState
          title="Nenhum prazo registado"
          description="Os seus prazos aparecerao aqui quando forem adicionados"
        />
      ) : (
        <div className="bg-surface-raised border border-border p-4 space-y-3">
          {prazos.slice(0, 5).map((prazo) => {
            const dueDate = new Date(prazo.dueDate)
            const isPast = dueDate < new Date()

            return (
              <Link
                key={prazo.id}
                href={`/prazos/${prazo.id}`}
                className="block bg-surface border border-border p-3 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {prazo.isUrgent && (
                      <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink mb-1 truncate">{prazo.title}</p>
                      <p className="text-xs font-mono text-ink-muted">{prazo.processo.processoNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-xs font-medium',
                          isPast ? 'text-danger' : 'text-warning',
                        )}
                      >
                        {getRelativeTime(dueDate)}
                      </p>
                    </div>
                    {prazo.status === PrazoStatus.PENDENTE && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleComplete()
                        }}
                        className="p-1 hover:bg-success-bg transition-colors"
                        title="Marcar como cumprido"
                      >
                        <CheckCircle className="w-4 h-4 text-success" />
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
          <Link
            href="/prazos"
            className="block text-center text-sm text-ink-muted hover:text-ink font-medium pt-2"
          >
            Ver todos os prazos →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: stats, loading } = useApi<DashboardStats>('/stats/dashboard')

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink mb-2">
            {getGreeting()}, {session?.user?.firstName}!
          </h1>
          <p className="text-ink-muted">Aqui esta o resumo da sua actividade</p>
        </div>
        <button
          onClick={() => {
            const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/reports/dashboard`
            window.open(url, '_blank')
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:text-ink border border-border rounded-lg hover:bg-surface-raised transition-colors"
        >
          <FileDown className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Processos Activos"
          value={stats?.activeProcessos ?? 0}
          icon={Scale}
          iconColor=""
          loading={loading}
        />
        <StatCard
          title="Prazos Urgentes"
          value={stats?.upcomingPrazos ?? 0}
          icon={Clock}
          iconColor=""
          loading={loading}
        />
        <StatCard
          title="Clientes"
          value={stats?.activeClientes ?? 0}
          icon={Users}
          iconColor=""
          loading={loading}
        />
        <StatCard
          title="Consultas IA Restantes"
          value={stats?.aiQueriesRemaining ?? 50}
          icon={Bot}
          iconColor=""
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProximosPrazosSection />

        <div>
          <h2 className="font-display text-[20px] font-medium text-ink mb-4">
            Actividade Recente
          </h2>
          <EmptyState
            title="Nenhuma actividade"
            description="A sua actividade recente aparecera aqui"
          />
        </div>
      </div>
    </div>
  )
}
