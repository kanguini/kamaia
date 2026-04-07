'use client'

import { useSession } from 'next-auth/react'
import { Scale, Clock, Users, Bot, AlertCircle } from 'lucide-react'
import { useApi } from '@/hooks/use-api'

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
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">Proximos Prazos</h2>
          <EmptyState
            title="Nenhum prazo registado"
            description="Os seus prazos aparecerao aqui quando forem adicionados"
          />
        </div>

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
