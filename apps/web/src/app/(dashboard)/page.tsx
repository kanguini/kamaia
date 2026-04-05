'use client'

import { useSession } from 'next-auth/react'
import { Scale, Clock, Users, Bot, AlertCircle } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor: string
}

function StatCard({ title, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <div className="bg-bone rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm font-mono mb-1">{title}</p>
          <p className="text-3xl font-semibold text-ink">{value}</p>
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
          value={0}
          icon={Scale}
          iconColor="bg-amber/10 text-amber"
        />
        <StatCard
          title="Prazos Urgentes"
          value={0}
          icon={Clock}
          iconColor="bg-error/10 text-error"
        />
        <StatCard
          title="Clientes"
          value={0}
          icon={Users}
          iconColor="bg-info/10 text-info"
        />
        <StatCard
          title="Consultas IA Restantes"
          value={50}
          icon={Bot}
          iconColor="bg-success/10 text-success"
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
