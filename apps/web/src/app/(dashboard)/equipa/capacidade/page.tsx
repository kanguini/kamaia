'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

interface WeekCell {
  weekStart: string
  plannedMinutes: number
  actualMinutes: number
  utilization: number
}
interface UserRow {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  }
  plannedPct: number
  weeks: WeekCell[]
}
interface CapacityData {
  weekStart: string
  weeks: number
  grid: UserRow[]
}

/** Map utilisation ratio to a heatmap colour. */
function utilColor(u: number, hasPlan: boolean): string {
  if (!hasPlan) return 'bg-surface'
  if (u === 0) return 'bg-slate-100 dark:bg-slate-800/40'
  if (u < 0.5) return 'bg-sky-100 dark:bg-sky-900/30'
  if (u < 0.8) return 'bg-emerald-100 dark:bg-emerald-900/30'
  if (u <= 1.0) return 'bg-emerald-300 dark:bg-emerald-700/60'
  if (u <= 1.2) return 'bg-amber-300 dark:bg-amber-700/60'
  return 'bg-red-400 dark:bg-red-700/80'
}

function utilLabel(u: number): string {
  if (u === 0) return '0%'
  return `${Math.round(u * 100)}%`
}

function shortWeek(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CapacityHeatmapPage() {
  const [weeks, setWeeks] = useState(8)
  // Default to Monday of this week
  const today = new Date()
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7))
  const [weekStart, setWeekStart] = useState<string>(
    monday.toISOString().slice(0, 10),
  )

  const { data, loading } = useApi<CapacityData>(
    `/projects/capacity?weekStart=${weekStart}T00:00:00.000Z&weeks=${weeks}`,
    [weekStart, weeks],
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/equipa" className="p-2 border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold text-ink">Capacidade</h1>
          <p className="text-sm text-ink-muted">
            Planeado (allocation × 40h) vs real (timesheets) por semana.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="px-3 py-1.5 text-sm bg-surface border border-border"
          />
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 text-sm bg-surface border border-border"
          >
            <option value={4}>4 semanas</option>
            <option value={8}>8 semanas</option>
            <option value={12}>12 semanas</option>
          </select>
        </div>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-slate-100 dark:bg-slate-800/40 border border-border" />
          0%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-sky-100 dark:bg-sky-900/30" />
          &lt;50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-emerald-100 dark:bg-emerald-900/30" />
          50–80%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-emerald-300 dark:bg-emerald-700/60" />
          80–100%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-amber-300 dark:bg-amber-700/60" />
          100–120%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-red-400 dark:bg-red-700/80" />
          &gt;120%
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
        </div>
      ) : !data || data.grid.length === 0 ? (
        <div className="p-10 text-center text-sm text-ink-muted bg-surface-raised flex flex-col items-center gap-2">
          <Users className="w-8 h-8" />
          Sem membros de equipa no período seleccionado.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th
                  className="text-left px-3 py-2 font-medium text-ink-muted sticky left-0 bg-surface-raised"
                  style={{ minWidth: 200 }}
                >
                  Membro
                </th>
                <th className="text-right px-2 py-2 font-medium text-ink-muted">Plan</th>
                {data.grid[0]?.weeks.map((w) => (
                  <th key={w.weekStart} className="px-2 py-2 font-mono text-ink-muted">
                    {shortWeek(w.weekStart)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.grid.map((row) => {
                const hasPlan = row.plannedPct > 0
                return (
                  <tr key={row.user.id} className="border-b border-border">
                    <td
                      className="px-3 py-2 sticky left-0 bg-surface"
                      style={{ minWidth: 200 }}
                    >
                      <p className="text-sm text-ink">
                        {row.user.firstName} {row.user.lastName}
                      </p>
                      <p className="text-[10px] font-mono text-ink-muted">
                        {row.user.role}
                      </p>
                    </td>
                    <td className="text-right px-2 py-2 font-mono text-ink-muted">
                      {row.plannedPct}%
                    </td>
                    {row.weeks.map((w) => (
                      <td
                        key={w.weekStart}
                        className={cn(
                          'text-center px-2 py-2 font-mono',
                          utilColor(w.utilization, hasPlan),
                        )}
                        title={`Planeado ${(w.plannedMinutes / 60).toFixed(1)}h · Real ${(w.actualMinutes / 60).toFixed(1)}h`}
                      >
                        {hasPlan ? utilLabel(w.utilization) : '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
