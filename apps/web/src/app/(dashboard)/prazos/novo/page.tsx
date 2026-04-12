'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { PrazoType, PaginatedResponse } from '@kamaia/shared-types'

const PRAZO_TYPE_LABELS: Record<PrazoType, string> = {
  [PrazoType.CONTESTACAO]: 'Contestacao',
  [PrazoType.RECURSO]: 'Recurso',
  [PrazoType.RESPOSTA]: 'Resposta',
  [PrazoType.ALEGACOES]: 'Alegacoes',
  [PrazoType.AUDIENCIA]: 'Audiencia',
  [PrazoType.OUTRO]: 'Outro',
}

const ALERT_OPTIONS = [
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
  { value: '168', label: '1 semana' },
]

const createPrazoSchema = z.object({
  processoId: z.string().min(1, 'Processo e obrigatorio'),
  type: z.nativeEnum(PrazoType, { required_error: 'Tipo e obrigatorio' }),
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().optional(),
  dueDate: z.string().min(1, 'Data limite e obrigatoria'),
  alertBeforeHours: z.number().optional(),
  isUrgent: z.boolean().optional(),
})

type CreatePrazoData = z.infer<typeof createPrazoSchema>

interface Processo {
  id: string
  processoNumber: string
  title: string
}

function PrazosNovoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedProcessoId = searchParams.get('processoId')

  const { data: processosData } = useApi<PaginatedResponse<Processo>>(
    '/processos?limit=50&status=ACTIVO',
  )
  const { mutate, loading, error } = useMutation<CreatePrazoData, { id: string }>(
    '/prazos',
    'POST',
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePrazoData>({
    resolver: zodResolver(createPrazoSchema),
    defaultValues: {
      processoId: preSelectedProcessoId || '',
      isUrgent: false,
      alertBeforeHours: 48,
    },
  })

  const formData = watch()
  const processos = processosData?.data || []

  // Auto-fill title based on type
  useEffect(() => {
    if (formData.type && !formData.title) {
      const titles: Record<PrazoType, string> = {
        [PrazoType.CONTESTACAO]: 'Prazo de Contestacao',
        [PrazoType.RECURSO]: 'Prazo de Recurso',
        [PrazoType.RESPOSTA]: 'Prazo de Resposta',
        [PrazoType.ALEGACOES]: 'Prazo de Alegacoes',
        [PrazoType.AUDIENCIA]: 'Prazo de Audiencia',
        [PrazoType.OUTRO]: 'Prazo',
      }
      setValue('title', titles[formData.type])
    }
  }, [formData.type, formData.title, setValue])

  const onSubmit = async (data: CreatePrazoData) => {
    const result = await mutate(data)
    if (result?.id) {
      router.push('/prazos')
    }
  }

  const showLegalSuggestion =
    formData.type === PrazoType.CONTESTACAO || formData.type === PrazoType.RECURSO

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/prazos"
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-4xl font-semibold text-ink">Novo Prazo</h1>
      </div>

      <div className="bg-surface-raised p-6">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger  p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Processo <span className="text-danger">*</span>
            </label>
            {processos.length === 0 ? (
              <div className="bg-warning/10 border border-warning/20  p-6 text-center">
                <p className="text-warning mb-4">Nenhum processo activo encontrado</p>
                <Link
                  href="/processos/novo"
                  className="inline-flex items-center gap-2 bg-ink text-white font-medium px-6 py-2.5  hover:bg-[#1a1a1a] transition-colors"
                >
                  Criar Processo Primeiro
                </Link>
              </div>
            ) : (
              <select
                {...register('processoId')}
                className={cn(
                  'w-full px-4 py-2.5 bg-surface border  transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                  errors.processoId ? 'border-danger' : 'border-border',
                )}
              >
                <option value="">Selecione um processo</option>
                {processos.map((processo) => (
                  <option key={processo.id} value={processo.id}>
                    {processo.processoNumber} - {processo.title}
                  </option>
                ))}
              </select>
            )}
            {errors.processoId && (
              <p className="text-danger text-sm mt-1">{errors.processoId.message}</p>
            )}
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

          {showLegalSuggestion && (
            <div className="bg-surface-raised border border-border-strong  p-4">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-ink flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink mb-1">Prazo legal sugerido:</p>
                  <p className="text-sm text-ink-muted">
                    {formData.type === PrazoType.CONTESTACAO
                      ? 'Art. 486.º CPC — 20 dias para contestar a partir da citacao'
                      : 'Art. 643.º CPC — 15 dias para interpor recurso'}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                'flex-1 bg-ink text-white font-medium py-2.5 ',
                'hover:bg-[#1a1a1a] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Prazo'
              )}
            </button>

            <Link
              href="/prazos"
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

export default function NovoPrazoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-pulse text-ink-muted">A carregar...</div></div>}>
      <PrazosNovoContent />
    </Suspense>
  )
}
