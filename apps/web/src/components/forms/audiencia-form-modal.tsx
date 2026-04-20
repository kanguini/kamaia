'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Modal } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  AudienciaType,
  AudienciaStatus,
  AUDIENCIA_TYPE_LABELS,
  AUDIENCIA_STATUS_LABELS,
} from '@kamaia/shared-types'

// ── Modal único com 4 modos de interacção sobre audiências ──
// schedule — cria nova (apenas se processoId)
// postpone — fecha actual + cria nova linkada via previousId
// markHeld — transita AGENDADA → REALIZADA (outcome obrigatório)
// cancel   — transita AGENDADA → CANCELADA (reason obrigatório)

export type AudienciaModalMode = 'schedule' | 'postpone' | 'markHeld' | 'cancel'

export interface AudienciaLite {
  id: string
  type: AudienciaType | string
  status: AudienciaStatus | string
  scheduledAt: string
  location: string | null
  judge: string | null
}

interface AudienciaFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  mode: AudienciaModalMode
  processoId: string
  audiencia?: AudienciaLite | null
}

// ── Schemas por modo ─────────────────────────────────────────

const scheduleSchema = z.object({
  type: z.nativeEnum(AudienciaType),
  scheduledAt: z.string().min(1, 'Data/hora obrigatória'),
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  location: z.string().max(200).optional(),
  judge: z.string().max(200).optional(),
  notes: z.string().optional(),
})
type ScheduleForm = z.infer<typeof scheduleSchema>

const postponeSchema = z.object({
  newScheduledAt: z.string().min(1, 'Nova data/hora obrigatória'),
  reason: z.string().min(1, 'Motivo obrigatório'),
  location: z.string().max(200).optional(),
  judge: z.string().max(200).optional(),
  notes: z.string().optional(),
})
type PostponeForm = z.infer<typeof postponeSchema>

const markHeldSchema = z.object({
  heldAt: z.string().optional(),
  outcome: z.string().min(1, 'Resultado obrigatório'),
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
})
type MarkHeldForm = z.infer<typeof markHeldSchema>

const cancelSchema = z.object({
  reason: z.string().min(1, 'Motivo obrigatório'),
})
type CancelForm = z.infer<typeof cancelSchema>

// Conversão segura para o formato que <input type="datetime-local"> espera.
function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDateTimeLocal(value: string): string {
  // Browser dá "YYYY-MM-DDTHH:mm" em hora local. Queremos ISO com tz.
  return new Date(value).toISOString()
}

const MODE_CONFIG: Record<
  AudienciaModalMode,
  { title: string; submitLabel: string; loadingLabel: string }
> = {
  schedule: {
    title: 'Agendar Audiência',
    submitLabel: 'Agendar',
    loadingLabel: 'A agendar…',
  },
  postpone: {
    title: 'Adiar Audiência',
    submitLabel: 'Adiar',
    loadingLabel: 'A adiar…',
  },
  markHeld: {
    title: 'Marcar como Realizada',
    submitLabel: 'Registar Resultado',
    loadingLabel: 'A registar…',
  },
  cancel: {
    title: 'Cancelar Audiência',
    submitLabel: 'Cancelar Audiência',
    loadingLabel: 'A cancelar…',
  },
}

export function AudienciaFormModal({
  open,
  onClose,
  onSuccess,
  mode,
  processoId,
  audiencia,
}: AudienciaFormModalProps) {
  const { data: session } = useSession()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const cfg = MODE_CONFIG[mode]

  // Renderiza o formulário adequado ao modo. Cada branch usa o seu próprio
  // hook useForm — simplifica tipagem e previne cross-mode state leak.
  return (
    <Modal open={open} onClose={onClose} title={cfg.title} size="md">
      {mode === 'schedule' && (
        <ScheduleForm
          processoId={processoId}
          onClose={onClose}
          onSuccess={onSuccess}
          session={session}
          toast={toast}
          submitting={submitting}
          setSubmitting={setSubmitting}
          cfg={cfg}
        />
      )}
      {mode === 'postpone' && audiencia && (
        <PostponeForm
          audiencia={audiencia}
          onClose={onClose}
          onSuccess={onSuccess}
          session={session}
          toast={toast}
          submitting={submitting}
          setSubmitting={setSubmitting}
          cfg={cfg}
        />
      )}
      {mode === 'markHeld' && audiencia && (
        <MarkHeldFormBody
          audiencia={audiencia}
          onClose={onClose}
          onSuccess={onSuccess}
          session={session}
          toast={toast}
          submitting={submitting}
          setSubmitting={setSubmitting}
          cfg={cfg}
        />
      )}
      {mode === 'cancel' && audiencia && (
        <CancelFormBody
          audiencia={audiencia}
          onClose={onClose}
          onSuccess={onSuccess}
          session={session}
          toast={toast}
          submitting={submitting}
          setSubmitting={setSubmitting}
          cfg={cfg}
        />
      )}
    </Modal>
  )
}

// ── Componentes por modo ────────────────────────────────────

type Common = {
  onClose: () => void
  onSuccess?: () => void
  session: ReturnType<typeof useSession>['data']
  toast: ReturnType<typeof useToast>
  submitting: boolean
  setSubmitting: (v: boolean) => void
  cfg: (typeof MODE_CONFIG)[AudienciaModalMode]
}

function ScheduleForm({
  processoId,
  onClose,
  onSuccess,
  session,
  toast,
  submitting,
  setSubmitting,
  cfg,
}: Common & { processoId: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { type: AudienciaType.AUDIENCIA_PREVIA },
  })

  const onSubmit = async (data: ScheduleForm) => {
    if (!session?.accessToken) return
    setSubmitting(true)
    try {
      await api('/audiencias', {
        method: 'POST',
        body: JSON.stringify({
          processoId,
          type: data.type,
          scheduledAt: fromDateTimeLocal(data.scheduledAt),
          durationMinutes: data.durationMinutes,
          location: data.location || undefined,
          judge: data.judge || undefined,
          notes: data.notes || undefined,
        }),
        token: session.accessToken,
      })
      toast.success('Audiência agendada')
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Erro ao agendar audiência')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FieldSelect label="Tipo" required error={errors.type?.message} {...register('type')}>
        {Object.values(AudienciaType)
          .filter((v) => typeof v === 'string')
          .map((v) => (
            <option key={v as string} value={v as string}>
              {AUDIENCIA_TYPE_LABELS[v as AudienciaType]}
            </option>
          ))}
      </FieldSelect>

      <FieldDateTime
        label="Data / hora"
        required
        error={errors.scheduledAt?.message}
        {...register('scheduledAt')}
      />

      <div className="grid grid-cols-2 gap-4">
        <FieldText
          type="number"
          label="Duração (min)"
          placeholder="ex.: 60"
          error={errors.durationMinutes?.message}
          {...register('durationMinutes')}
        />
        <FieldText
          label="Juiz"
          placeholder="Dr. …"
          error={errors.judge?.message}
          {...register('judge')}
        />
      </div>

      <FieldText
        label="Local"
        placeholder="Tribunal / sala"
        error={errors.location?.message}
        {...register('location')}
      />

      <FieldTextarea label="Notas" rows={3} {...register('notes')} />

      <FormActions
        submitting={submitting}
        cfg={cfg}
        onClose={onClose}
        variant="primary"
      />
    </form>
  )
}

function PostponeForm({
  audiencia,
  onClose,
  onSuccess,
  session,
  toast,
  submitting,
  setSubmitting,
  cfg,
}: Common & { audiencia: AudienciaLite }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostponeForm>({
    resolver: zodResolver(postponeSchema),
  })

  const onSubmit = async (data: PostponeForm) => {
    if (!session?.accessToken) return
    setSubmitting(true)
    try {
      await api(`/audiencias/${audiencia.id}/postpone`, {
        method: 'POST',
        body: JSON.stringify({
          newScheduledAt: fromDateTimeLocal(data.newScheduledAt),
          reason: data.reason,
          location: data.location || undefined,
          judge: data.judge || undefined,
          notes: data.notes || undefined,
        }),
        token: session.accessToken,
      })
      toast.success('Audiência adiada; nova data agendada')
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Erro ao adiar audiência')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <CurrentAudienciaSummary audiencia={audiencia} />

      <FieldDateTime
        label="Nova data / hora"
        required
        error={errors.newScheduledAt?.message}
        {...register('newScheduledAt')}
      />

      <FieldTextarea
        label="Motivo"
        required
        rows={2}
        placeholder="ex.: Indisponibilidade do juiz, adiamento requerido pela contraparte…"
        error={errors.reason?.message}
        {...register('reason')}
      />

      <div className="grid grid-cols-2 gap-4">
        <FieldText
          label="Local (opcional)"
          placeholder="Se mudou de sala"
          {...register('location')}
        />
        <FieldText label="Juiz (opcional)" {...register('judge')} />
      </div>

      <FieldTextarea label="Notas" rows={2} {...register('notes')} />

      <FormActions
        submitting={submitting}
        cfg={cfg}
        onClose={onClose}
        variant="primary"
      />
    </form>
  )
}

function MarkHeldFormBody({
  audiencia,
  onClose,
  onSuccess,
  session,
  toast,
  submitting,
  setSubmitting,
  cfg,
}: Common & { audiencia: AudienciaLite }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MarkHeldForm>({
    resolver: zodResolver(markHeldSchema),
    defaultValues: { heldAt: toDateTimeLocal(new Date().toISOString()) },
  })

  const onSubmit = async (data: MarkHeldForm) => {
    if (!session?.accessToken) return
    setSubmitting(true)
    try {
      await api(`/audiencias/${audiencia.id}/held`, {
        method: 'POST',
        body: JSON.stringify({
          heldAt: data.heldAt ? fromDateTimeLocal(data.heldAt) : undefined,
          outcome: data.outcome,
          durationMinutes: data.durationMinutes,
        }),
        token: session.accessToken,
      })
      toast.success('Audiência marcada como realizada')
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Erro ao registar resultado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <CurrentAudienciaSummary audiencia={audiencia} />

      <FieldDateTime
        label="Realizada em"
        error={errors.heldAt?.message}
        {...register('heldAt')}
      />

      <FieldTextarea
        label="Resultado / narrativa"
        required
        rows={4}
        placeholder="Resumo do que ficou decidido: designação de data para sentença, tentativa de conciliação frustrada, acordo parcial…"
        error={errors.outcome?.message}
        {...register('outcome')}
      />

      <FieldText
        type="number"
        label="Duração efectiva (min)"
        placeholder="ex.: 45"
        error={errors.durationMinutes?.message}
        {...register('durationMinutes')}
      />

      <FormActions
        submitting={submitting}
        cfg={cfg}
        onClose={onClose}
        variant="primary"
      />
    </form>
  )
}

function CancelFormBody({
  audiencia,
  onClose,
  onSuccess,
  session,
  toast,
  submitting,
  setSubmitting,
  cfg,
}: Common & { audiencia: AudienciaLite }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelForm>({
    resolver: zodResolver(cancelSchema),
  })

  const onSubmit = async (data: CancelForm) => {
    if (!session?.accessToken) return
    setSubmitting(true)
    try {
      await api(`/audiencias/${audiencia.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: data.reason }),
        token: session.accessToken,
      })
      toast.success('Audiência cancelada')
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Erro ao cancelar audiência')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <CurrentAudienciaSummary audiencia={audiencia} />

      <FieldTextarea
        label="Motivo do cancelamento"
        required
        rows={3}
        placeholder="ex.: Acordo extrajudicial alcançado, desistência da acção…"
        error={errors.reason?.message}
        {...register('reason')}
      />

      <FormActions
        submitting={submitting}
        cfg={cfg}
        onClose={onClose}
        variant="danger"
      />
    </form>
  )
}

// ── Primitivas de UI ────────────────────────────────────────

function CurrentAudienciaSummary({ audiencia }: { audiencia: AudienciaLite }) {
  const typeLabel =
    AUDIENCIA_TYPE_LABELS[audiencia.type as AudienciaType] ?? audiencia.type
  const statusLabel =
    AUDIENCIA_STATUS_LABELS[audiencia.status as AudienciaStatus] ?? audiencia.status
  const scheduled = new Date(audiencia.scheduledAt).toLocaleString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="bg-surface border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-info/10 text-info border border-info/20 rounded-full">
          {typeLabel}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted/10 text-ink-muted border border-muted/20 rounded-full">
          {statusLabel}
        </span>
      </div>
      <p className="text-sm text-ink font-mono">{scheduled}</p>
      {(audiencia.location || audiencia.judge) && (
        <p className="text-xs text-ink-muted mt-0.5">
          {[audiencia.location, audiencia.judge].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

const FieldText = ({
  label,
  error,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  required?: boolean
}) => (
  <div>
    <label className="block text-sm font-mono font-medium text-ink mb-2">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <input
      {...props}
      className={cn(
        'w-full px-4 py-2.5 bg-surface border transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
        error ? 'border-danger' : 'border-border',
      )}
    />
    {error && <p className="text-danger text-sm mt-1">{error}</p>}
  </div>
)

const FieldTextarea = ({
  label,
  error,
  required,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  required?: boolean
}) => (
  <div>
    <label className="block text-sm font-mono font-medium text-ink mb-2">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <textarea
      {...props}
      className={cn(
        'w-full px-4 py-2.5 bg-surface border transition-colors resize-none',
        'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
        error ? 'border-danger' : 'border-border',
      )}
    />
    {error && <p className="text-danger text-sm mt-1">{error}</p>}
  </div>
)

const FieldSelect = ({
  label,
  error,
  required,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
  required?: boolean
}) => (
  <div>
    <label className="block text-sm font-mono font-medium text-ink mb-2">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <select
      {...props}
      className={cn(
        'w-full px-4 py-2.5 bg-surface border transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
        error ? 'border-danger' : 'border-border',
      )}
    >
      {children}
    </select>
    {error && <p className="text-danger text-sm mt-1">{error}</p>}
  </div>
)

const FieldDateTime = ({
  label,
  error,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  required?: boolean
}) => (
  <div>
    <label className="block text-sm font-mono font-medium text-ink mb-2">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <input
      type="datetime-local"
      {...props}
      className={cn(
        'w-full px-4 py-2.5 bg-surface border transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
        error ? 'border-danger' : 'border-border',
      )}
    />
    {error && <p className="text-danger text-sm mt-1">{error}</p>}
  </div>
)

function FormActions({
  submitting,
  cfg,
  onClose,
  variant,
}: {
  submitting: boolean
  cfg: (typeof MODE_CONFIG)[AudienciaModalMode]
  onClose: () => void
  variant: 'primary' | 'danger'
}) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          'flex-1 font-medium py-2.5 transition-colors flex items-center justify-center gap-2',
          variant === 'danger'
            ? 'bg-danger text-white hover:bg-danger/90'
            : '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] hover:[background:var(--color-btn-primary-hover)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {cfg.loadingLabel}
          </>
        ) : (
          cfg.submitLabel
        )}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="px-6 py-2.5 border border-border text-sm font-medium text-ink-muted hover:bg-surface transition-colors"
      >
        Fechar
      </button>
    </div>
  )
}
