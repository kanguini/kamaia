'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { PrazoType } from '@kamaia/shared-types'

const PRAZO_TYPE_LABELS: Record<PrazoType, string> = {
  [PrazoType.CONTESTACAO]: 'Contestacao',
  [PrazoType.RECURSO]: 'Recurso',
  [PrazoType.RESPOSTA]: 'Resposta',
  [PrazoType.ALEGACOES]: 'Alegacoes',
  [PrazoType.AUDIENCIA]: 'Audiência',
  [PrazoType.OUTRO]: 'Outro',
}

const ALERT_OPTIONS = [
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
  { value: '168', label: '1 semana' },
]

const updatePrazoSchema = z.object({
  type: z.nativeEnum(PrazoType, { required_error: 'Tipo e obrigatorio' }),
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().optional(),
  dueDate: z.string().min(1, 'Data limite e obrigatoria'),
  alertBeforeHours: z.number().optional(),
  isUrgent: z.boolean().optional(),
})

type UpdatePrazoData = z.infer<typeof updatePrazoSchema>

interface Prazo {
  id: string
  title: string
  description: string | null
  type: PrazoType
  dueDate: string
  isUrgent: boolean
  alertBeforeHours: number | null
  processo: {
    id: string
    processoNumber: string
    title: string
  }
}

function PrazoSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 bg-surface-raised rounded w-1/3" />
      <div className="bg-surface-raised p-6 h-96" />
    </div>
  )
}

export default function EditarPrazoPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()

  const { data: prazo, loading: loadingPrazo, error: loadError } = useApi<Prazo>(`/prazos/${id}`)
  const { mutate, loading, error } = useMutation<UpdatePrazoData, Prazo>(
    `/prazos/${id}`,
    'PUT',
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdatePrazoData>({
    resolver: zodResolver(updatePrazoSchema),
  })

  useEffect(() => {
    if (prazo) {
      // Convert ISO date to datetime-local format
      const dueDateLocal = prazo.dueDate ? new Date(prazo.dueDate).toISOString().slice(0, 16) : ''

      reset({
        type: prazo.type,
        title: prazo.title,
        description: prazo.description || '',
        dueDate: dueDateLocal,
        alertBeforeHours: prazo.alertBeforeHours || 48,
        isUrgent: prazo.isUrgent || false,
      })
    }
  }, [prazo, reset])

  const toast = useToast()

  const onSubmit = async (data: UpdatePrazoData) => {
    const result = await mutate(data)
    if (result?.id) {
      toast.success('Prazo actualizado')
      router.push(`/prazos/${id}`)
    } else {
      toast.error('Erro ao actualizar prazo')
    }
  }

  if (loadingPrazo) return <PrazoSkeleton />

  if (loadError || !prazo) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4">
          {loadError || 'Prazo não encontrado'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/prazos/${id}`}
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-4xl font-semibold text-ink">Editar Prazo</h1>
      </div>

      <div className="bg-surface-raised p-6">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger  p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-surface  p-4">
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Processo</p>
            <p className="font-medium text-ink">{prazo.processo.processoNumber}</p>
            <p className="text-sm text-ink-muted">{prazo.processo.title}</p>
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Tipo <span className="text-danger">*</span>
            </label>
            <select
              {...register('type')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.type ? 'border-danger' : 'border-border',
              )}
            >
              <option value="">Selecione o tipo</option>
              {Object.entries(PRAZO_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.type && <p className="text-danger text-sm mt-1">{errors.type.message}</p>}
          </div>

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
                errors.title ? 'border-danger' : 'border-border',
              )}
              placeholder="Ex: Prazo de Contestacao"
            />
            {errors.title && <p className="text-danger text-sm mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">Descricao</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              placeholder="Notas adicionais sobre este prazo"
            />
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Data Limite <span className="text-danger">*</span>
            </label>
            <input
              type="datetime-local"
              {...register('dueDate')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.dueDate ? 'border-danger' : 'border-border',
              )}
            />
            {errors.dueDate && <p className="text-danger text-sm mt-1">{errors.dueDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Alertar antes
            </label>
            <select
              {...register('alertBeforeHours', { valueAsNumber: true })}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            >
              {ALERT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('isUrgent')}
                className="w-5 h-5 text-ink border-border rounded focus:ring-2 focus:ring-ink"
              />
              <div>
                <span className="text-sm font-medium text-ink">Marcar como urgente</span>
                <p className="text-xs text-ink-muted">
                  Prazos urgentes recebem destaque especial no dashboard
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex-1 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5 ',
                'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Alteracoes'
              )}
            </button>

            <Link
              href={`/prazos/${id}`}
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
