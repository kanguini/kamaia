'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight, X, MapPin, Clock, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { CalendarEventType } from '@kamaia/shared-types'

type ViewMode = 'month' | 'week' | 'day'

interface CalendarEvent {
  id: string
  title: string
  type: CalendarEventType
  startAt: string
  endAt: string
  allDay: boolean
  location?: string
  description?: string
  source?: 'event' | 'prazo'
  processo?: {
    id: string
    processoNumber: string
    title: string
  }
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const _DAY_NAMES_FULL = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']
void _DAY_NAMES_FULL

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  [CalendarEventType.AUDIENCIA]: 'Audiencia',
  [CalendarEventType.REUNIAO]: 'Reuniao',
  [CalendarEventType.DILIGENCIA]: 'Diligencia',
  [CalendarEventType.PRAZO]: 'Prazo',
  [CalendarEventType.OUTRO]: 'Outro',
}

function getEventColor(type: CalendarEventType, isUrgent?: boolean): string {
  if (type === CalendarEventType.PRAZO) {
    return isUrgent ? 'bg-danger text-surface' : 'bg-warning text-warning-text'
  }
  switch (type) {
    case CalendarEventType.AUDIENCIA:
      return 'bg-warning text-warning-text'
    case CalendarEventType.REUNIAO:
      return 'bg-info text-surface'
    case CalendarEventType.DILIGENCIA:
      return 'bg-ink-muted/60 text-surface'
    default:
      return 'bg-surface-raised border border-border text-ink'
  }
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EventDetailModal({ event, onClose, onDelete, onComplete }: {
  event: CalendarEvent
  onClose: () => void
  onDelete: () => void
  onComplete?: () => void
}) {
  const isPrazo = event.source === 'prazo'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface shadow-lg max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-semibold text-ink mb-2">{event.title}</h2>
            <span className={cn('inline-block px-2 py-1 text-xs font-mono ', getEventColor(event.type))}>
              {EVENT_TYPE_LABELS[event.type]}
            </span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-ink-muted flex-shrink-0 mt-0.5" />
            <div>
              {event.allDay ? (
                <p className="text-ink">Todo o dia</p>
              ) : (
                <p className="text-ink">
                  {formatDate(event.startAt)} — {formatTime(event.endAt)}
                </p>
              )}
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-ink-muted flex-shrink-0 mt-0.5" />
              <p className="text-ink">{event.location}</p>
            </div>
          )}

          {event.processo && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-ink-muted flex-shrink-0 mt-0.5" />
              <Link
                href={`/processos/${event.processo.id}`}
                className="text-info hover:underline font-mono text-sm"
                onClick={onClose}
              >
                {event.processo.processoNumber}
              </Link>
            </div>
          )}

          {event.description && (
            <div className="bg-surface border border-border p-3">
              <p className="text-sm text-ink whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {isPrazo && (
            <div className="bg-warning-bg border border-warning p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-ink flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-ink">Este evento e um prazo</p>
                  <Link
                    href={`/prazos/${event.id}`}
                    className="text-xs text-ink-muted hover:underline"
                    onClick={onClose}
                  >
                    Ver detalhes do prazo
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          {isPrazo && onComplete ? (
            <button
              onClick={() => {
                onComplete()
                onClose()
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-success-bg text-success-text font-medium px-4 py-2.5  hover:bg-success transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar Cumprido
            </button>
          ) : (
            <>
              <Link
                href={`/agenda/novo?eventId=${event.id}`}
                className="flex-1 text-center [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium px-4 py-2.5 hover:[background:var(--color-btn-primary-hover)] transition-colors"
                onClick={onClose}
              >
                Editar
              </Link>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja eliminar este evento?')) {
                    onDelete()
                    onClose()
                  }
                }}
                className="px-4 py-2.5 border border-danger text-danger-text hover:bg-danger/10 transition-colors"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const { startDate, endDate } = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (view === 'month') {
      start.setDate(1)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)

      // Extend to fill grid weeks
      const firstDay = start.getDay()
      const lastDay = end.getDay()
      start.setDate(start.getDate() - (firstDay === 0 ? 6 : firstDay - 1))
      end.setDate(end.getDate() + (lastDay === 0 ? 0 : 7 - lastDay))
    } else if (view === 'week') {
      const monday = getMonday(currentDate)
      start.setTime(monday.getTime())
      end.setTime(monday.getTime())
      end.setDate(end.getDate() + 6)
    } else {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }
  }, [currentDate, view])

  const endpoint = `/calendar/events?startDate=${startDate}&endDate=${endDate}`
  const { data, loading, refetch } = useApi<{ data: CalendarEvent[] }>(endpoint, [startDate, endDate])
  const { mutate: deleteEvent } = useMutation(`/calendar/events/ID`, 'DELETE')
  const { mutate: completePrazo } = useMutation(`/prazos/ID/complete`, 'PATCH')

  const events = data?.data || []

  const navigate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate)

    if (direction === 'today') {
      setCurrentDate(new Date())
      return
    }

    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    }

    setCurrentDate(newDate)
  }

  const handleDelete = async () => {
    if (selectedEvent) {
      await deleteEvent(undefined)
      refetch()
    }
  }

  const handleComplete = async () => {
    if (selectedEvent) {
      await completePrazo(undefined)
      refetch()
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold text-ink">Agenda</h1>
        <Link
          href="/agenda/novo"
          className="flex items-center gap-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium px-6 py-2.5 hover:[background:var(--color-btn-primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Evento
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-surface-raised p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('prev')}
              className="p-2 hover:bg-surface transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </button>

            <div className="flex items-center gap-2 bg-surface overflow-hidden">
              <button
                onClick={() => setView('month')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  view === 'month' ? '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]' : 'text-ink-muted hover:bg-surface-raised'
                )}
              >
                Mes
              </button>
              <button
                onClick={() => setView('week')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  view === 'week' ? '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]' : 'text-ink-muted hover:bg-surface-raised'
                )}
              >
                Semana
              </button>
              <button
                onClick={() => setView('day')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  view === 'day' ? '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]' : 'text-ink-muted hover:bg-surface-raised'
                )}
              >
                Dia
              </button>
            </div>

            <button
              onClick={() => navigate('next')}
              className="p-2 hover:bg-surface transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-ink" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {view === 'day'
                ? `${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                : `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              }
            </h2>
            <button
              onClick={() => navigate('today')}
              className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="bg-surface-raised p-12 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-border rounded w-1/4 mx-auto" />
            <div className="h-4 bg-border rounded w-1/3 mx-auto" />
          </div>
        </div>
      ) : view === 'month' ? (
        <MonthView
          currentDate={currentDate}
          events={events}
          onEventClick={setSelectedEvent}
          onDayClick={(date) => {
            setCurrentDate(date)
            setView('day')
          }}
        />
      ) : view === 'week' ? (
        <WeekView
          currentDate={currentDate}
          events={events}
          onEventClick={setSelectedEvent}
        />
      ) : (
        <DayView
          currentDate={currentDate}
          events={events}
          onEventClick={setSelectedEvent}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDelete}
          onComplete={selectedEvent.source === 'prazo' ? handleComplete : undefined}
        />
      )}
    </div>
  )
}

function MonthView({ currentDate, events, onEventClick, onDayClick }: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
}) {
  const month = currentDate.getMonth()
  const year = currentDate.getFullYear()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startDate = new Date(firstDay)
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  const endDate = new Date(lastDay)
  const lastDayOfWeek = endDate.getDay()
  endDate.setDate(endDate.getDate() + (lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek))

  const days: Date[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="bg-surface-raised overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-surface border-b border-border">
        {DAY_NAMES.map(day => (
          <div key={day} className="p-3 text-center text-sm font-mono font-medium text-ink-muted">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === month
          const isToday = day.getTime() === today.getTime()
          const dayEvents = events.filter(e => {
            const eventDate = new Date(e.startAt)
            eventDate.setHours(0, 0, 0, 0)
            return eventDate.getTime() === day.getTime()
          })

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={cn(
                'min-h-[100px] p-2 border-b border-r border-border bg-surface cursor-pointer hover:bg-surface-raised/50 transition-colors',
                !isCurrentMonth && 'bg-surface-raised text-ink-muted/50',
                isToday && 'ring-2 ring-ink ring-inset'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-sm font-medium',
                  isCurrentMonth ? 'text-ink' : 'text-ink-muted/50',
                  isToday && 'text-ink font-bold'
                )}>
                  {day.getDate()}
                </span>
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                    className={cn(
                      'w-full text-left px-1.5 py-0.5  text-xs truncate',
                      getEventColor(event.type)
                    )}
                  >
                    {event.allDay ? '' : formatTime(event.startAt) + ' '}{event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-ink-muted px-1.5">+{dayEvents.length - 3} mais</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ currentDate, events, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}) {
  const monday = getMonday(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const hours = Array.from({ length: 15 }, (_, i) => i + 7) // 7:00 to 21:00

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const showCurrentTime = currentHour >= 7 && currentHour <= 22

  return (
    <div className="bg-surface-raised overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-8 bg-surface border-b border-border">
        <div className="p-3" /> {/* Empty corner */}
        {weekDays.map((day, i) => {
          const isToday = day.getTime() === today.getTime()
          return (
            <div key={i} className={cn('p-3 text-center', isToday && 'ring-2 ring-ink')}>
              <div className="text-xs font-mono text-ink-muted">{DAY_NAMES[i]}</div>
              <div className={cn('text-lg font-semibold', isToday ? 'text-ink' : 'text-ink')}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="relative">
        <div className="grid grid-cols-8">
          {hours.map(hour => (
            <>
              <div key={`hour-${hour}`} className="p-3 text-right text-xs font-mono text-ink-muted border-b border-border bg-surface">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, i) => {
                const dayStart = new Date(day)
                dayStart.setHours(hour, 0, 0, 0)
                const dayEnd = new Date(day)
                dayEnd.setHours(hour + 1, 0, 0, 0)

                const hourEvents = events.filter(e => {
                  if (e.allDay) return false
                  const start = new Date(e.startAt)
                  return start >= dayStart && start < dayEnd
                })

                return (
                  <div key={`${hour}-${i}`} className="relative min-h-[60px] border-b border-r border-border bg-surface p-1">
                    {hourEvents.map(event => {
                      const start = new Date(event.startAt)
                      const end = new Date(event.endAt)
                      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                      const height = Math.max(durationHours * 60, 40)

                      return (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className={cn(
                            'absolute left-1 right-1  p-1.5 text-xs text-left overflow-hidden',
                            getEventColor(event.type)
                          )}
                          style={{ height: `${height}px` }}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-[10px] opacity-80">{formatTime(event.startAt)}</div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          ))}
        </div>

        {/* Current time indicator */}
        {showCurrentTime && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-danger pointer-events-none z-10"
            style={{ top: `${((currentHour - 7) * 60)}px` }}
          >
            <div className="absolute -left-2 -top-1.5 w-3 h-3 bg-danger" />
          </div>
        )}
      </div>
    </div>
  )
}

function DayView({ currentDate, events, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7)

  const dayStart = new Date(currentDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(currentDate)
  dayEnd.setHours(23, 59, 59, 999)

  const dayEvents = events.filter(e => {
    const start = new Date(e.startAt)
    return start >= dayStart && start <= dayEnd
  })

  const timedEvents = dayEvents.filter(e => !e.allDay)
  const allDayEvents = dayEvents.filter(e => e.allDay)
  const prazos = dayEvents.filter(e => e.source === 'prazo')

  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const showCurrentTime = currentHour >= 7 && currentHour <= 22 &&
    now.toDateString() === currentDate.toDateString()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Timeline */}
      <div className="md:col-span-2 bg-surface-raised overflow-hidden">
        {allDayEvents.length > 0 && (
          <div className="bg-surface border-b border-border p-4 space-y-2">
            <div className="text-xs font-mono text-ink-muted mb-2">TODO O DIA</div>
            {allDayEvents.map(event => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className={cn(
                  'w-full text-left px-3 py-2  text-sm',
                  getEventColor(event.type)
                )}
              >
                {event.title}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          {hours.map(hour => {
            const hourStart = new Date(currentDate)
            hourStart.setHours(hour, 0, 0, 0)
            const hourEnd = new Date(currentDate)
            hourEnd.setHours(hour + 1, 0, 0, 0)

            const hourEvents = timedEvents.filter(e => {
              const start = new Date(e.startAt)
              return start >= hourStart && start < hourEnd
            })

            return (
              <div key={hour} className="flex border-b border-border bg-surface min-h-[60px]">
                <div className="w-20 p-3 text-right text-xs font-mono text-ink-muted bg-surface border-r border-border">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {hourEvents.map(event => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className={cn(
                        'w-full text-left px-3 py-2 ',
                        getEventColor(event.type)
                      )}
                    >
                      <div className="font-medium text-sm">{event.title}</div>
                      <div className="text-xs opacity-90">
                        {formatTime(event.startAt)} — {formatTime(event.endAt)}
                      </div>
                      {event.location && (
                        <div className="text-xs opacity-80 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                      )}
                      {event.processo && (
                        <div className="text-xs opacity-80 mt-1 font-mono">
                          {event.processo.processoNumber}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {showCurrentTime && (
            <div
              className="absolute left-20 right-0 h-0.5 bg-danger pointer-events-none z-10"
              style={{ top: `${((currentHour - 7) * 60)}px` }}
            >
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-danger" />
            </div>
          )}
        </div>
      </div>

      {/* Prazos sidebar */}
      <div className="bg-surface-raised p-4">
        <h3 className="font-display text-lg font-semibold text-ink mb-4">Prazos de Hoje</h3>
        {prazos.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum prazo para hoje</p>
        ) : (
          <div className="space-y-3">
            {prazos.map(prazo => (
              <button
                key={prazo.id}
                onClick={() => onEventClick(prazo)}
                className="w-full text-left bg-surface p-3 hover:bg-surface-hover transition-colors border border-border"
              >
                <div className="font-medium text-sm text-ink mb-1">{prazo.title}</div>
                <div className="text-xs text-ink-muted">{prazo.allDay ? 'Todo o dia' : formatTime(prazo.startAt)}</div>
                {prazo.processo && (
                  <div className="text-xs font-mono text-ink-muted mt-1">{prazo.processo.processoNumber}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
