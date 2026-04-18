'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Scale, Clock, Users,
  TrendingUp, Trophy,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { PrazoStatus, LIFECYCLE_LABELS } from '@kamaia/shared-types'

// Lazy load recharts to avoid SSR issues
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

interface DashboardStats {
  activeProcessos: number
  upcomingPrazos: number
  activeClientes: number
  aiQueriesRemaining: number
}

interface KPIData {
  processosByType: Record<string, number>
  processosByLifecycle: Record<string, number>
  prazosByStatus: { pendente: number; cumprido: number; expirado: number }
  revenueByMonth: Array<{ month: string; value: number }>
  topProcessos: Array<{ id: string; title: string; horas: number; valor: number }>
  overduePrazos: number
  totalDocuments: number
  totalTimeHours: number
}

interface TaskscoreUser {
  userId: string
  userName: string
  score: number
  breakdown: {
    processosCriados: number
    fasesAvancadas: number
    prazosCumpridos: number
    horasRegistadas: number
    documentosEnviados: number
    notasAdicionadas: number
  }
}

interface UpcomingPrazo {
  id: string
  title: string
  dueDate: string
  isUrgent: boolean
  status: PrazoStatus
  processo: { id: string; processoNumber: string }
}

const TYPE_LABELS: Record<string, string> = {
  CIVEL: 'Civel',
  LABORAL: 'Laboral',
  COMERCIAL: 'Comercial',
  CRIMINAL: 'Criminal',
  ADMINISTRATIVO: 'Admin.',
  FAMILIA: 'Familia',
  ARBITRAGEM: 'Arbitragem',
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#f97316']

function StatCard({ title, value, icon: Icon, loading }: {
  title: string; value: string | number; icon: React.ElementType; loading?: boolean
}) {
  return (
    <div className="bg-surface-raised p-5 rounded-lg border border-border">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
          <Icon className="w-4 h-4 text-ink-muted" />
        </div>
        <p className="text-xs text-ink-muted uppercase tracking-wide">{title}</p>
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-border animate-pulse rounded" />
      ) : (
        <p className="text-3xl font-bold text-ink">{value}</p>
      )}
    </div>
  )
}

function formatAKZ(centavos: number) {
  return `${(centavos / 100).toLocaleString('pt-AO')} Kz`
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: stats, loading } = useApi<DashboardStats>('/stats/dashboard')
  const { data: kpis, loading: kpisLoading } = useApi<KPIData>('/stats/kpis')
  const { data: taskscore } = useApi<TaskscoreUser[]>('/stats/taskscore?period=month')
  const { data: prazosData } = useApi<{ upcoming: UpcomingPrazo[]; overdue: UpcomingPrazo[] }>('/prazos/upcoming')

  const prazos = [...(prazosData?.upcoming || []), ...(prazosData?.overdue || [])]
  const myScore = taskscore?.find(t => t.userId === (session?.user as any)?.id)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  // Prepare chart data
  const typeChartData = kpis
    ? Object.entries(kpis.processosByType).map(([type, count]) => ({
        name: TYPE_LABELS[type] || type,
        value: count,
      }))
    : []

  const revenueChartData = kpis?.revenueByMonth.map(r => ({
    month: r.month.split('-')[1] + '/' + r.month.split('-')[0].slice(2),
    valor: Math.round(r.value / 100),
  })) || []

  const lifecycleData = kpis
    ? Object.entries(kpis.processosByLifecycle).map(([stage, count]) => ({
        name: LIFECYCLE_LABELS[stage] || stage,
        count,
      }))
    : []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-ink mb-1">
          {getGreeting()}, {session?.user?.firstName}!
        </h1>
        <p className="text-ink-muted text-sm">Resumo da sua atividade</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Processos Activos" value={stats?.activeProcessos ?? 0} icon={Scale} loading={loading} />
        <StatCard title="Prazos Urgentes" value={stats?.upcomingPrazos ?? 0} icon={Clock} loading={loading} />
        <StatCard title="Clientes" value={stats?.activeClientes ?? 0} icon={Users} loading={loading} />
        <StatCard title="Horas Registadas" value={kpis?.totalTimeHours ?? 0} icon={TrendingUp} loading={kpisLoading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processos by Type (Pie) */}
        <div className="bg-surface-raised rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Processos por Tipo</h2>
          {typeChartData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {typeChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-ink-muted text-sm">Sem dados</div>
          )}
        </div>

        {/* Revenue by Month (Bar) */}
        <div className="bg-surface-raised rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Receita Mensal (AKZ)</h2>
          {revenueChartData.some(r => r.valor > 0) ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} Kz`, 'Receita']} />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-ink-muted text-sm">Sem dados de receita</div>
          )}
        </div>
      </div>

      {/* Pipeline + Taskscore + Prazos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Overview */}
        <div className="bg-surface-raised rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Pipeline</h2>
          <div className="space-y-2">
            {lifecycleData.map((stage) => {
              const maxCount = Math.max(...lifecycleData.map(s => s.count), 1)
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted w-24 truncate">{stage.name}</span>
                  <div className="flex-1 h-5 bg-surface rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500/20 rounded flex items-center px-2"
                      style={{ width: `${Math.max((stage.count / maxCount) * 100, 8)}%` }}
                    >
                      <span className="text-[10px] font-mono text-ink-muted">{stage.count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Taskscore */}
        <div className="bg-surface-raised rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-ink">Taskscore</h2>
          </div>
          {myScore ? (
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-ink">{myScore.score}</p>
              <p className="text-xs text-ink-muted mt-1">pontos este mes</p>
            </div>
          ) : (
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-ink-muted">0</p>
              <p className="text-xs text-ink-muted mt-1">sem atividade</p>
            </div>
          )}
          {taskscore && taskscore.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Ranking</p>
              {taskscore.slice(0, 5).map((user, i) => (
                <div key={user.userId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-surface text-ink-muted',
                    )}>
                      {i + 1}
                    </span>
                    <span className="text-ink truncate max-w-[120px]">{user.userName}</span>
                  </div>
                  <span className="font-mono text-ink-muted text-xs">{user.score} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proximos Prazos */}
        <div className="bg-surface-raised rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-ink-muted" />
            <h2 className="text-sm font-semibold text-ink">Proximos Prazos</h2>
          </div>
          {prazos.length === 0 ? (
            <div className="text-center py-6 text-ink-muted text-sm">Sem prazos pendentes</div>
          ) : (
            <div className="space-y-2">
              {prazos.slice(0, 5).map((prazo) => {
                const isPast = new Date(prazo.dueDate) < new Date()
                return (
                  <Link
                    key={prazo.id}
                    href={`/prazos/${prazo.id}`}
                    className="block p-2 rounded hover:bg-surface transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{prazo.title}</p>
                        <p className="text-[10px] font-mono text-ink-muted">{prazo.processo.processoNumber}</p>
                      </div>
                      <span className={cn('text-xs font-medium', isPast ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                        {new Date(prazo.dueDate).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </Link>
                )
              })}
              <Link href="/prazos" className="block text-center text-xs text-ink-muted hover:text-ink pt-2">
                Ver todos →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Top Processos + Prazos Status */}
      {kpis && kpis.topProcessos.length > 0 && (
        <div className="bg-surface-raised rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Top Processos por Valor</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-muted uppercase border-b border-border">
                  <th className="text-left py-2 pr-4">Processo</th>
                  <th className="text-right py-2 px-4">Horas</th>
                  <th className="text-right py-2 pl-4">Valor</th>
                </tr>
              </thead>
              <tbody>
                {kpis.topProcessos.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <Link href={`/processos/${p.id}`} className="text-ink hover:underline truncate block max-w-[250px]">
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-right py-2 px-4 font-mono text-ink-muted">{p.horas}h</td>
                    <td className="text-right py-2 pl-4 font-mono text-ink">{formatAKZ(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prazos Status Summary */}
      {kpis && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-raised rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{kpis.prazosByStatus.pendente}</p>
            <p className="text-xs text-ink-muted mt-1">Pendentes</p>
          </div>
          <div className="bg-surface-raised rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{kpis.prazosByStatus.cumprido}</p>
            <p className="text-xs text-ink-muted mt-1">Cumpridos</p>
          </div>
          <div className="bg-surface-raised rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{kpis.prazosByStatus.expirado}</p>
            <p className="text-xs text-ink-muted mt-1">Expirados</p>
          </div>
        </div>
      )}
    </div>
  )
}
