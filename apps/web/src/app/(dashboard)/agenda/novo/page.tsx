'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Search, X } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { CalendarEventType, PaginatedResponse } from '@kamaia/shared-types'

const EVENT_TYPE_LABELS: Record<Exclude<CalendarEventType, CalendarEventType.PRAZO>, string> = {
  [CalendarEventType.AUDIENCIA]: 'Audiência',
  [CalendarEventType.REUNIAO]: 'Reunião',
  [CalendarEventType.DILIGENCIA]: 'Diligencia',
  [CalendarEventType.OUTRO]: 'Outro',
}

const REMINDER_OPTIONS = [
  { value: null, label: 'Sem lembrete' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 1440, label: '24 horas' },
  { value: 2880, label: '48 horas' },
]

const createEventSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  type: z.enum([
    CalendarEventType.AUDIENCIA,
    CalendarEventType.REUNIAO,
    CalendarEventType.DILIGENCIA,
    CalendarEventType.OUTRO,
  ]),
  allDay: z.boolean().optional(),
  startAt: z.string().min(1, 'Data de inicio e obrigatoria'),
  endAt: z.string().min(1, 'Data de fim e obrigatoria'),
  location: z.string().optional(),
  processoId: z.string().optional(),
  description: z.string().optional(),
  reminderMinutes: z.number().nullable().optional(),
}).refine(
  (data) => {
    const start = new Date(data.startAt)
    const end = new Date(data.endAt)
    return end > start
  },
  {
    message: 'Data de fim deve ser posterior a data de inicio',
    path: ['endAt'],
  }
)

type CreateEventData = z.infer<typeof createEventSchema>

interface Processo {
  id: string
  processoNumber: string
  title: string
}

interface CalendarEvent {
  id: string
  title: string
  type: CalendarEventType
  startAt: string
  endAt: string
  allDay: boolean
  location?: string
  description?: string
  processoId?: string
  reminderMinutes?: number | null
  processo?: {
    id: string
    processoNumber: string
    title: string
  }
}

function AgendaNovoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const isEditMode = !!eventId

  const [processoSearch, setProcessoSearch] = useState('')
  const [showProcessoDropdown, setShowProcessoDropdown] = useState(false)

  // Fetch event data if editing
  const { data: eventData } = useApi<{ data: CalendarEvent }>(
    isEditMode ? `/calendar/events/${eventId}` : null,
    [eventId]
  )

  // Fetch processos
  const { data: processosData } = useApi<PaginatedResponse<Processo>>(
    '/processos?limit=50&status=ACTIVO'
  )

  const { mutate: createEvent, loading: creating, error: createError } = useMutation<CreateEventData, { id: string }>(
    '/calendar/events',
    'POST'
  )

  const { mutate: updateEvent, loading: updating, error: updateError } = useMutation<CreateEventData, { id: string }>(
    `/calendar/events/${eventId}`,
    'PUT'
  )

  const loading = creating || updating
  const error = createError || updateError

  const processos = processosData?.data || []
  const filteredProcessos = useMemo(() => {
    if (!processoSearch) return processos
    const search = processoSearch.toLowerCase()
    return processos.filter(
      p =>
        p.processoNumber.toLowerCase().includes(search) ||
        p.title.toLowerCase().includes(search)
    )
  }, [processos, processoSearch])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateEventData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      allDay: false,
      reminderMinutes: null,
      type: CalendarEventType.REUNIAO,
    },
  })

  const formData = watch()
  const selectedProcesso = processos.find(p => p.id === formData.processoId)

  // Pre-fill form when editing
  useEffect(() => {
    if (eventData?.data && isEditMode) {
      const event = eventData.data
      setValue('title', event.title)
      setValue('type', event.type as typeof CalendarEventType.AUDIENCIA)
      setValue('allDay', event.allDay)
      setValue('startAt', formatDateTimeLocal(event.startAt, event.allDay))
      setValue('endAt', formatDateTimeLocal(event.endAt, event.allDay))
      if (event.location) setValue('location', event.location)
      if (event.description) setValue('description', event.description)
      if (event.processoId) setValue('processoId', event.processoId)
      if (event.reminderMinutes) setValue('reminderMinutes', event.reminderMinutes)
    }
  }, [eventData, isEditMode, setValue])

  const onSubmit = async (data: CreateEventData) => {
    const result = isEditMode
      ? await updateEvent(data)
      : await createEvent(data)

    if (result?.id) {
      router.push('/agenda')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/agenda"
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-4xl font-semibold text-ink">
          {isEditMode ? 'Editar Evento' : 'Novo Evento'}
        </h1>
      </div>

      <div className="bg-surface-raised p-6">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger  p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Titulo <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              {...register('title')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.title ? 'border-danger' : 'border-border'
              )}
              placeholder="Ex: Reuniao com cliente"
            />
            {errors.title && <p className="text-danger text-sm mt-1">{errors.title.message}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Tipo <span className="text-danger">*</span>
            </label>
            <select
              {...register('type')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.type ? 'border-danger' : 'border-border'
              )}
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.type && <p className="text-danger text-sm mt-1">{errors.type.message}</p>}
          </div>

          {/* All Day */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('allDay')}
                className="w-5 h-5 text-ink border-border rounded focus:ring-2 focus:ring-ink"
              />
              <span className="text-sm font-medium text-ink">Todo o dia</span>
            </label>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Data Inicio <span className="text-danger">*</span>
            </label>
            <input
              type={formData.allDay ? 'date' : 'datetime-local'}
              {...register('startAt')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.startAt ? 'border-danger' : 'border-border'
              )}
            />
            {errors.startAt && <p className="text-danger text-sm mt-1">{errors.startAt.message}</p>}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Data Fim <span className="text-danger">*</span>
            </label>
            <input
              type={formData.allDay ? 'date' : 'datetime-local'}
              {...register('endAt')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.endAt ? 'border-danger' : 'border-border'
              )}
            />
            {errors.endAt && <p className="text-danger text-sm mt-1">{errors.endAt.message}</p>}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">Localizacao</label>
            <input
              type="text"
              {...register('location')}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
              placeholder="Ex: Tribunal Provincial de Luanda"
            />
          </div>

          {/* Processo */}
          <div className="relative">
            <label className="block text-sm font-mono font-medium text-ink mb-2">Processo</label>

            {selectedProcesso ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border ">
                <div className="flex-1">
                  <div className="font-mono text-sm text-ink">{selectedProcesso.processoNumber}</div>
                  <div className="text-xs text-ink-muted">{selectedProcesso.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('processoId', undefined)}
                  className="p-1 hover:bg-surface-raised rounded transition-colors"
                >
                  <X className="w-4 h-4 text-ink-muted" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
                  <input
                    type="text"
                    value={processoSearch}
                    onChange={(e) => {
                      setProcessoSearch(e.target.value)
                      setShowProcessoDropdown(true)
                    }}
                    onFocus={() => setShowProcessoDropdown(true)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                    placeholder="Pesquisar processo..."
                  />
                </div>

                {showProcessoDropdown && filteredProcessos.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-surface border border-border  shadow-lg max-h-60 overflow-y-auto">
                    {filteredProcessos.map((processo) => (
                      <button
                        key={processo.id}
                        type="button"
                        onClick={() => {
                          setValue('processoId', processo.id)
                          setShowProcessoDropdown(false)
                          setProcessoSearch('')
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-surface-raised transition-colors border-b border-border last:border-0"
                      >
                        <div className="font-mono text-sm text-ink">{processo.processoNumber}</div>
                        <div className="text-xs text-ink-muted mt-0.5">{processo.title}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {processos.length === 0 && (
              <div className="mt-2 bg-warning/10 border border-warning/20  p-3">
                <p className="text-xs text-warning">
                  Nenhum processo activo. <Link href="/processos/novo" className="underline">Criar processo</Link>
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">Descricao</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              placeholder="Notas adicionais sobre este evento"
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">Lembrete</label>
            <select
              {...register('reminderMinutes', {
                setValueAs: (v) => v === '' || v === 'null' ? null : Number(v)
              })}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.label} value={option.value ?? 'null'}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex-1 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5 ',
                'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditMode ? 'Guardando...' : 'Criando...'}
                </>
              ) : (
                isEditMode ? 'Guardar Alteracoes' : 'Criar Evento'
              )}
            </button>

            <Link
              href="/agenda"
              className="px-6 py-2.5 border border-border  text-sm font-medium text-ink-muted hover:bg-surface transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatDateTimeLocal(dateString: string, allDay: boolean): string {
  const date = new Date(dateString)

  if (allDay) {
    // Return just the date part in YYYY-MM-DD format
    return date.toISOString().split('T')[0]
  }

  // Return datetime-local format YYYY-MM-DDTHH:mm
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function NovoEventoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-pulse text-ink-muted">A carregar...</div></div>}>
      <AgendaNovoContent />
    </Suspense>
  )
}
