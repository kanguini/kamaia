'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Clock, Users, TrendingUp, AlertTriangle,
  Briefcase, Banknote, Bell, CircleDollarSign, Receipt,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

interface ExecutiveDashboard {
  financial: {
    revenueBilledThisMonth: number
    revenuePaidThisMonth: number
    outstandingTotal: number
    outstandingInvoices: number
    wipValue: number
    currency: string
  }
  operational: {
    billableHoursThisMonth: number
    loggedHoursThisMonth: number
    billableRatio: number
    activeProjects: number
    upcomingPrazos: number
  }
  risk: {
    atRiskProjects: Array<{
      id: string
      name: string
      code: string
      category: string
      healthStatus: 'YELLOW' | 'RED'
      endDate: string | null
    }>
    criticalPrazos: Array<{
      id: string
      title: string
      dueDate: string
      isUrgent: boolean
      type: string
      processo: { id: string; processoNumber: string; title: string }
    }>
    overduePrazos: number
    unreadAlerts: number
    recentAlerts: Array<{
      id: string
      type: string
      subject: string
      body: string
      createdAt: string
      metadata: { projectId?: string; milestoneId?: string }
    }>
  }
  topWipClientes: Array<{
    clienteId: string
    clienteName: string
    hours: number
    value: number
  }>
}

function formatAKZ(centavos: number): string {
  if (centavos === 0) return '0 AKZ'
  if (Math.abs(centavos) >= 1_000_000_00) {
    return `${(centavos / 100_000_000).toFixed(1)}M AKZ`
  }
  if (Math.abs(centavos) >= 1_000_00) {
    return `${(centavos / 100_000).toFixed(1)}k AKZ`
  }
  return `${(centavos / 100).toLocaleString('pt-AO')} AKZ`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'agora'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data, loading } = useApi<ExecutiveDashboard>('/stats/executive')

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Greeting */}
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink">
          {getGreeting()}, {session?.user?.firstName}
        </h1>
        <p className="text-sm text-ink-muted mt-1">Visão executiva do gabinete</p>
      </header>

      {loading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface-raised p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Top KPIs — financial + operational */}
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              icon={CircleDollarSign}
              tone="success"
              title="Facturado este mês"
              value={formatAKZ(data.financial.revenueBilledThisMonth)}
              subtitle={`${formatAKZ(data.financial.revenuePaidThisMonth)} já recebidos`}
              href="/facturas"
            />
            <KpiCard
              icon={Receipt}
              tone={data.financial.outstandingTotal > 0 ? 'warning' : 'neutral'}
              title="Em dívida"
              value={formatAKZ(data.financial.outstandingTotal)}
              subtitle={`${data.financial.outstandingInvoices} factura(s) pendente(s)`}
              href="/facturas?status=SENT"
            />
            <KpiCard
              icon={Banknote}
              tone="neutral"
              title="WIP por facturar"
              value={formatAKZ(data.financial.wipValue)}
              subtitle="timesheets billable ainda não emitidos"
              href="/facturas/nova"
            />
            <KpiCard
              icon={TrendingUp}
              tone="neutral"
              title="Horas facturáveis"
              value={`${data.operational.billableHoursThisMonth}h`}
              subtitle={`${Math.round(data.operational.billableRatio * 100)}% de ${data.operational.loggedHoursThisMonth}h totais`}
              href="/timesheets"
            />
            <KpiCard
              icon={Briefcase}
              tone="neutral"
              title="Projectos activos"
              value={data.operational.activeProjects}
              subtitle={
                data.risk.atRiskProjects.length > 0
                  ? `${data.risk.atRiskProjects.length} em atenção`
                  : 'todos saudáveis'
              }
              href="/projectos"
            />
            <KpiCard
              icon={Clock}
              tone={
                data.risk.overduePrazos > 0
                  ? 'danger'
                  : data.operational.upcomingPrazos > 3
                    ? 'warning'
                    : 'neutral'
              }
              title="Prazos esta semana"
              value={data.operational.upcomingPrazos}
              subtitle={
                data.risk.overduePrazos > 0
                  ? `${data.risk.overduePrazos} já em atraso`
                  : 'tudo no prazo'
              }
              href="/prazos"
            />
          </section>

          {/* Two-column: Risk + WIP/Clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Projectos em atenção */}
            <section className="bg-surface border border-border">
              <header className="px-4 py-3 border-b border-border flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-ink-muted" />
                <h2 className="text-sm font-medium text-ink">Projectos em atenção</h2>
                <Link
                  href="/projectos"
                  className="ml-auto text-[11px] text-ink-muted hover:text-ink"
                >
                  ver todos →
                </Link>
              </header>
              {data.risk.atRiskProjects.length === 0 ? (
                <p className="px-4 py-6 text-xs text-ink-muted text-center">
                  Todos os projectos saudáveis. ✓
                </p>
              ) : (
                <ul>
                  {data.risk.atRiskProjects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/projectos/${p.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-surface-raised"
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            p.healthStatus === 'RED' ? 'bg-red-500' : 'bg-amber-500',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink truncate">{p.name}</p>
                          <p className="text-xs font-mono text-ink-muted">
                            {p.code} · {p.category}
                            {p.endDate &&
                              ` · ${new Date(p.endDate).toLocaleDateString('pt-AO', {
                                day: '2-digit',
                                month: 'short',
                              })}`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Prazos críticos */}
            <section className="bg-surface border border-border">
              <header className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Clock className="w-4 h-4 text-ink-muted" />
                <h2 className="text-sm font-medium text-ink">Prazos críticos</h2>
                <Link
                  href="/prazos"
                  className="ml-auto text-[11px] text-ink-muted hover:text-ink"
                >
                  ver todos →
                </Link>
              </header>
              {data.risk.criticalPrazos.length === 0 ? (
                <p className="px-4 py-6 text-xs text-ink-muted text-center">
                  Sem prazos críticos nos próximos 3 dias.
                </p>
              ) : (
                <ul>
                  {data.risk.criticalPrazos.map((p) => {
                    const isPast = new Date(p.dueDate) < new Date()
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/prazos/${p.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-surface-raised"
                        >
                          <span
                            className={cn(
                              'text-xs font-mono px-1.5 py-0.5 rounded',
                              isPast
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : p.isUrgent
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-surface-raised text-ink-muted',
                            )}
                          >
                            {new Date(p.dueDate).toLocaleDateString('pt-AO', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink truncate">{p.title}</p>
                            <p className="text-xs font-mono text-ink-muted truncate">
                              {p.processo.processoNumber}
                            </p>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Alerts */}
            <section className="bg-surface border border-border">
              <header className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Bell className="w-4 h-4 text-ink-muted" />
                <h2 className="text-sm font-medium text-ink">Alertas</h2>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-surface-raised rounded">
                  {data.risk.unreadAlerts}
                </span>
              </header>
              {data.risk.recentAlerts.length === 0 ? (
                <p className="px-4 py-6 text-xs text-ink-muted text-center">
                  Sem alertas por ler.
                </p>
              ) : (
                <ul>
                  {data.risk.recentAlerts.map((a) => (
                    <li
                      key={a.id}
                      className="px-4 py-2.5 border-b border-border"
                    >
                      <p className="text-sm text-ink line-clamp-1">{a.subject}</p>
                      {a.body && (
                        <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">
                          {a.body}
                        </p>
                      )}
                      <p className="text-[10px] font-mono text-ink-muted mt-1">
                        {formatRelative(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Top WIP Clientes */}
          {data.topWipClientes.length > 0 && (
            <section className="bg-surface border border-border">
              <header className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-ink-muted" />
                <h2 className="text-sm font-medium text-ink">
                  Clientes com mais trabalho por facturar (WIP)
                </h2>
              </header>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-raised text-xs text-ink-muted">
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-right px-4 py-2">Horas</th>
                    <th className="text-right px-4 py-2">Valor</th>
                    <th className="px-4 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.topWipClientes.map((c) => (
                    <tr key={c.clienteId} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Link
                          href={`/clientes/${c.clienteId}`}
                          className="text-ink hover:underline"
                        >
                          {c.clienteName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-ink-muted">
                        {c.hours.toFixed(1)}h
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-ink">
                        {formatAKZ(c.value)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/facturas/nova?clienteId=${c.clienteId}`}
                          className="text-xs text-ink-muted hover:text-ink"
                        >
                          Facturar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  href,
  tone,
}: {
  icon: React.ElementType
  title: string
  value: string | number
  subtitle?: string
  href?: string
  tone?: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  const toneCls =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : tone === 'danger'
          ? 'text-red-600'
          : 'text-ink'

  const inner = (
    <div className="bg-surface-raised p-5 hover:bg-surface-hover transition-colors h-full">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ink-muted" />
        <p className="text-[10px] font-mono uppercase tracking-wide text-ink-muted">
          {title}
        </p>
      </div>
      <p className={cn('text-2xl font-semibold', toneCls)}>{value}</p>
      {subtitle && <p className="text-xs text-ink-muted mt-1">{subtitle}</p>}
    </div>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}

