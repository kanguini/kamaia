'use client'

/**
 * Interactive Gantt chart — pure SVG, no external lib.
 *
 * Features:
 *  - Timeline with day/week/month granularity (auto-selected by span)
 *  - Draggable bars (horizontal) to shift start+end
 *  - Draggable right edge to resize end date
 *  - Dependency arrows (FS — finish-to-start) between milestones
 *  - Progress fill on each bar
 *  - "Today" marker
 *  - onCommit callback fires with patch payload after drag ends
 *
 * Persists changes by calling the parent (which posts to the API); during
 * drag we keep optimistic local state so the UI stays responsive.
 */

import { useMemo, useRef, useState, useCallback } from 'react'

export interface GanttMilestone {
  id: string
  title: string
  startDate: string | null // ISO; if null, single-point milestone at dueDate
  dueDate: string // ISO
  progress: number // 0-100
  completedAt: string | null
  dependsOnId: string | null
}

interface GanttChartProps {
  milestones: GanttMilestone[]
  onCommit: (id: string, patch: { startDate?: string; dueDate?: string; progress?: number }) => void
  /** Optional extra days to pad either side of the span. */
  padDays?: number
}

type DragMode = 'move' | 'resize-end' | null

interface DragState {
  mode: DragMode
  id: string
  startX: number
  origStart: number // epoch ms
  origEnd: number // epoch ms
}

const ROW_HEIGHT = 36
const BAR_HEIGHT = 20
const HEADER_HEIGHT = 48
const LABEL_WIDTH = 200
const DAY_PX_MIN = 18 // minimum width of a day cell

const MS_PER_DAY = 86_400_000

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function addDays(ts: number, days: number): number {
  return ts + days * MS_PER_DAY
}

function formatMonth(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-AO', { month: 'short', year: '2-digit' })
}

function formatDay(ts: number): string {
  return String(new Date(ts).getDate()).padStart(2, '0')
}

export function GanttChart({ milestones, onCommit, padDays = 3 }: GanttChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // Local optimistic overrides during drag
  const [pending, setPending] = useState<Record<string, { startDate?: number; dueDate?: number }>>({})

  // ── Compute display values merging pending drags ────────
  const displayed = useMemo(() => {
    return milestones.map((m) => {
      const p = pending[m.id]
      const due = p?.dueDate ?? startOfDay(new Date(m.dueDate))
      const start = p?.startDate ?? (m.startDate ? startOfDay(new Date(m.startDate)) : due)
      return { ...m, _start: start, _end: due }
    })
  }, [milestones, pending])

  // ── Timeline span ───────────────────────────────────────
  const { startTs, endTs, totalDays } = useMemo(() => {
    if (displayed.length === 0) {
      const today = startOfDay(new Date())
      return {
        startTs: addDays(today, -padDays),
        endTs: addDays(today, 30),
        totalDays: 30 + padDays,
      }
    }
    const mins = Math.min(...displayed.map((m) => m._start))
    const maxs = Math.max(...displayed.map((m) => m._end))
    const s = addDays(mins, -padDays)
    const e = addDays(maxs, padDays)
    return { startTs: s, endTs: e, totalDays: Math.max(1, Math.round((e - s) / MS_PER_DAY)) }
  }, [displayed, padDays])

  // Auto-pick day width so that a reasonable range fits, but minimum readable
  const dayPx = Math.max(DAY_PX_MIN, Math.min(48, 900 / Math.max(totalDays, 14)))
  const timelineWidth = totalDays * dayPx
  const chartHeight = HEADER_HEIGHT + displayed.length * ROW_HEIGHT + 12

  // ── Helpers ─────────────────────────────────────────────
  const dateToX = useCallback(
    (ts: number) => ((ts - startTs) / MS_PER_DAY) * dayPx,
    [startTs, dayPx],
  )
  // ── Drag handlers ───────────────────────────────────────
  const onBarMouseDown = (
    e: React.MouseEvent,
    mode: 'move' | 'resize-end',
    m: { id: string; _start: number; _end: number },
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({
      mode,
      id: m.id,
      startX: e.clientX,
      origStart: m._start,
      origEnd: m._end,
    })
  }

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.startX
      const deltaDays = Math.round(dx / dayPx)
      if (deltaDays === 0 && !pending[drag.id]) return
      let nextStart = drag.origStart
      let nextEnd = drag.origEnd
      if (drag.mode === 'move') {
        nextStart = addDays(drag.origStart, deltaDays)
        nextEnd = addDays(drag.origEnd, deltaDays)
      } else if (drag.mode === 'resize-end') {
        nextEnd = Math.max(addDays(drag.origStart, 0), addDays(drag.origEnd, deltaDays))
      }
      setPending((p) => ({
        ...p,
        [drag.id]: { startDate: nextStart, dueDate: nextEnd },
      }))
    },
    [drag, dayPx, pending],
  )

  const onMouseUp = () => {
    if (!drag) return
    const p = pending[drag.id]
    if (p && (p.startDate !== drag.origStart || p.dueDate !== drag.origEnd)) {
      onCommit(drag.id, {
        startDate: new Date(p.startDate ?? drag.origStart).toISOString(),
        dueDate: new Date(p.dueDate ?? drag.origEnd).toISOString(),
      })
    }
    setDrag(null)
    // Keep optimistic state until parent re-fetches (avoids flicker)
    setTimeout(() => setPending({}), 600)
  }

  // ── Header cells ────────────────────────────────────────
  const dayCells = useMemo(() => {
    const cells: { ts: number; isMonthStart: boolean; isWeekStart: boolean; isWeekend: boolean }[] = []
    for (let i = 0; i < totalDays; i++) {
      const ts = addDays(startTs, i)
      const d = new Date(ts)
      cells.push({
        ts,
        isMonthStart: d.getDate() === 1,
        isWeekStart: d.getDay() === 1,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      })
    }
    return cells
  }, [startTs, totalDays])

  const today = startOfDay(new Date())
  const todayX = today >= startTs && today <= endTs ? dateToX(today) : null

  // ── Dependency arrows (finish-to-start) ─────────────────
  const arrows = useMemo(() => {
    const idx = new Map<string, number>()
    displayed.forEach((m, i) => idx.set(m.id, i))
    return displayed
      .map((m, toRow) => {
        if (!m.dependsOnId) return null
        const fromRow = idx.get(m.dependsOnId)
        if (fromRow == null) return null
        const from = displayed[fromRow]
        return {
          id: `${from.id}-${m.id}`,
          fromX: dateToX(from._end),
          fromY: HEADER_HEIGHT + fromRow * ROW_HEIGHT + ROW_HEIGHT / 2,
          toX: dateToX(m._start),
          toY: HEADER_HEIGHT + toRow * ROW_HEIGHT + ROW_HEIGHT / 2,
        }
      })
      .filter(Boolean) as {
      id: string
      fromX: number
      fromY: number
      toX: number
      toY: number
    }[]
  }, [displayed, dateToX])

  if (milestones.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-ink-muted bg-surface-raised">
        Nenhum marco ainda. Adicione marcos para visualizar o cronograma.
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto border border-border rounded-lg bg-surface">
      <div className="flex" style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
        {/* Left fixed label column */}
        <div
          className="flex-shrink-0 border-r border-border"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="px-3 flex items-end pb-2 text-[10px] font-mono uppercase text-ink-muted border-b border-border"
            style={{ height: HEADER_HEIGHT }}
          >
            Marcos
          </div>
          {displayed.map((m) => (
            <div
              key={m.id}
              className="px-3 border-b border-border flex items-center"
              style={{ height: ROW_HEIGHT }}
            >
              <p className="text-xs text-ink truncate" title={m.title}>
                {m.title}
              </p>
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div className="flex-1 relative">
          <svg
            ref={svgRef}
            width={timelineWidth}
            height={chartHeight}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: drag ? (drag.mode === 'move' ? 'grabbing' : 'ew-resize') : 'default' }}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>

            {/* Header: month labels */}
            {dayCells.map((c) =>
              c.isMonthStart ? (
                <g key={`m-${c.ts}`}>
                  <line
                    x1={dateToX(c.ts)}
                    y1={0}
                    x2={dateToX(c.ts)}
                    y2={chartHeight}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                  />
                  <text
                    x={dateToX(c.ts) + 4}
                    y={16}
                    fontSize={10}
                    fill="var(--color-ink)"
                    fontWeight={600}
                  >
                    {formatMonth(c.ts)}
                  </text>
                </g>
              ) : null,
            )}

            {/* Header: day numbers */}
            {dayCells.map((c) => (
              <g key={`d-${c.ts}`}>
                {c.isWeekend && (
                  <rect
                    x={dateToX(c.ts)}
                    y={HEADER_HEIGHT}
                    width={dayPx}
                    height={chartHeight - HEADER_HEIGHT}
                    fill="var(--color-surface-raised)"
                    opacity={0.4}
                  />
                )}
                <text
                  x={dateToX(c.ts) + dayPx / 2}
                  y={HEADER_HEIGHT - 6}
                  fontSize={9}
                  fill="var(--color-ink-muted)"
                  textAnchor="middle"
                >
                  {formatDay(c.ts)}
                </text>
              </g>
            ))}
            {/* Header baseline */}
            <line
              x1={0}
              y1={HEADER_HEIGHT}
              x2={timelineWidth}
              y2={HEADER_HEIGHT}
              stroke="var(--color-border)"
            />

            {/* Row dividers */}
            {displayed.map((_, i) => (
              <line
                key={`row-${i}`}
                x1={0}
                y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                x2={timelineWidth}
                y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                stroke="var(--color-border)"
                opacity={0.5}
              />
            ))}

            {/* Today line */}
            {todayX !== null && (
              <g>
                <line
                  x1={todayX}
                  y1={HEADER_HEIGHT}
                  x2={todayX}
                  y2={chartHeight}
                  stroke="#DC2626"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <text x={todayX + 3} y={HEADER_HEIGHT + 11} fontSize={9} fill="#DC2626">
                  hoje
                </text>
              </g>
            )}

            {/* Dependency arrows */}
            <g className="text-ink-muted" style={{ color: 'var(--color-ink-muted)' }}>
              {arrows.map((a) => {
                // Simple elbow path: go right from fromX, then down/up, then into toX
                const midX = Math.max(a.fromX + 8, a.toX - 8)
                const d = `M ${a.fromX} ${a.fromY} H ${midX} V ${a.toY} H ${a.toX}`
                return (
                  <path
                    key={a.id}
                    d={d}
                    stroke="currentColor"
                    strokeWidth={1.25}
                    fill="none"
                    markerEnd="url(#arrow)"
                    opacity={0.75}
                  />
                )
              })}
            </g>

            {/* Bars */}
            {displayed.map((m, i) => {
              const x = dateToX(m._start)
              const w = Math.max(dayPx * 0.6, dateToX(m._end) - x + dayPx)
              const y = HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
              const isDone = !!m.completedAt
              const fill = isDone ? '#16A34A' : '#111111'
              const progressW = (w * Math.max(0, Math.min(100, m.progress))) / 100
              return (
                <g key={m.id}>
                  {/* Bar body */}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={BAR_HEIGHT}
                    rx={4}
                    ry={4}
                    fill={fill}
                    opacity={0.14}
                    onMouseDown={(e) => onBarMouseDown(e, 'move', m)}
                    style={{ cursor: 'grab' }}
                  />
                  {/* Progress fill */}
                  <rect
                    x={x}
                    y={y}
                    width={progressW}
                    height={BAR_HEIGHT}
                    rx={4}
                    ry={4}
                    fill={fill}
                    onMouseDown={(e) => onBarMouseDown(e, 'move', m)}
                    style={{ cursor: 'grab' }}
                  />
                  {/* Right resize handle */}
                  <rect
                    x={x + w - 6}
                    y={y}
                    width={6}
                    height={BAR_HEIGHT}
                    fill="transparent"
                    onMouseDown={(e) => onBarMouseDown(e, 'resize-end', m)}
                    style={{ cursor: 'ew-resize' }}
                  />
                  {/* Title inside bar */}
                  <text
                    x={x + 8}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize={11}
                    fill={progressW > 40 ? '#FFFFFF' : 'var(--color-ink)'}
                    pointerEvents="none"
                  >
                    {m.title.length > Math.floor(w / 7)
                      ? `${m.title.slice(0, Math.floor(w / 7))}…`
                      : m.title}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-border flex items-center gap-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-ink rounded-sm" /> em curso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-600 rounded-sm" /> concluído
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-red-600" /> hoje
        </span>
        <span className="ml-auto text-[10px]">
          Arrasta a barra para deslocar · arrasta o bordo direito para redimensionar
        </span>
      </div>
    </div>
  )
}

/**
 * Hook helper: takes the raw milestones from the API and returns props
 * ready to pipe into <GanttChart>.
 */
export function toGanttMilestone(m: {
  id: string
  title: string
  startDate: string | null
  dueDate: string
  progress?: number
  completedAt: string | null
  dependsOnId?: string | null
}): GanttMilestone {
  return {
    id: m.id,
    title: m.title,
    startDate: m.startDate,
    dueDate: m.dueDate,
    progress: m.progress ?? (m.completedAt ? 100 : 0),
    completedAt: m.completedAt,
    dependsOnId: m.dependsOnId ?? null,
  }
}
