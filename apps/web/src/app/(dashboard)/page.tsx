'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Scale, Clock, Users, Bot, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
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

function StatCard({ title, value, icon: Icon, iconColor, loading }: StatCardProps) {
  return (
    <div className="bg-bone rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm font-mono mb-1">{title}</p>
          {loading ? (
            <div className="h-9 w-16 bg-border rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-semibold text-ink">{value}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-bone rounded-xl p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6 text-muted" />
      </div>
      <h3 className="text-ink font-medium mb-1">{title}</h3>
      <p className="text-muted text-sm">{description}</p>
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
      <h2 className="font-display text-2xl font-semibold text-ink mb-4">Proximos Prazos</h2>
      {loading ? (
        <div className="bg-bone rounded-xl p-6 space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-border rounded" />
          ))}
        </div>
      ) : !prazos || prazos.length === 0 ? (
        <EmptyState
          title="Nenhum prazo registado"
          description="Os seus prazos aparecerao aqui quando forem adicionados"
        />
      ) : (
        <div className="bg-bone rounded-xl p-4 space-y-3">
          {prazos.slice(0, 5).map((prazo) => {
            const dueDate = new Date(prazo.dueDate)
            const isPast = dueDate < new Date()

            return (
              <Link
                key={prazo.id}
                href={`/prazos/${prazo.id}`}
                className="block bg-paper rounded-lg p-3 hover:bg-bone transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {prazo.isUrgent && (
                      <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink mb-1 truncate">{prazo.title}</p>
                      <p className="text-xs font-mono text-muted">{prazo.processo.processoNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-xs font-medium',
                          isPast ? 'text-error' : 'text-warning',
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
                        className="p-1 hover:bg-success/10 rounded transition-colors"
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
            className="block text-center text-sm text-amber hover:text-amber-700 font-medium pt-2"
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
      <div>
        <h1 className="font-display text-4xl font-semibold text-ink mb-2">
          {getGreeting()}, {session?.user?.firstName}!
        </h1>
        <p className="text-muted">Aqui esta o resumo da sua actividade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Processos Activos"
          value={stats?.activeProcessos ?? 0}
          icon={Scale}
          iconColor="bg-amber/10 text-amber"
          loading={loading}
        />
        <StatCard
          title="Prazos Urgentes"
          value={stats?.upcomingPrazos ?? 0}
          icon={Clock}
          iconColor="bg-error/10 text-error"
          loading={loading}
        />
        <StatCard
          title="Clientes"
          value={stats?.activeClientes ?? 0}
          icon={Users}
          iconColor="bg-info/10 text-info"
          loading={loading}
        />
        <StatCard
          title="Consultas IA Restantes"
          value={stats?.aiQueriesRemaining ?? 50}
          icon={Bot}
          iconColor="bg-success/10 text-success"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProximosPrazosSection />

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">
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
