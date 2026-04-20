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
import { ProcessoType, ProcessoPriority } from '@kamaia/shared-types'

const PROCESSO_TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Civel',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Familia',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}

const updateProcessoSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().optional(),
  priority: z.nativeEnum(ProcessoPriority).optional(),
  court: z.string().optional(),
  courtCaseNumber: z.string().optional(),
  judge: z.string().optional(),
  opposingParty: z.string().optional(),
  opposingLawyer: z.string().optional(),
  feeType: z.enum(['FIXO', 'HORA', 'PERCENTAGEM', 'PRO_BONO']).optional(),
  feeAmount: z.number().optional(),
})

type UpdateProcessoData = z.infer<typeof updateProcessoSchema>

interface Processo {
  id: string
  title: string
  description: string | null
  type: ProcessoType
  priority: ProcessoPriority
  court: string | null
  courtCaseNumber: string | null
  judge: string | null
  opposingParty: string | null
  opposingLawyer: string | null
  feeType: string | null
  feeAmount: number | null
}

export default function EditarProcessoPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: processo, loading: loadingProcesso } = useApi<Processo>(`/processos/${id}`)
  const { mutate, loading, error } = useMutation<UpdateProcessoData>(`/processos/${id}`, 'PUT')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProcessoData>({
    resolver: zodResolver(updateProcessoSchema),
  })

  useEffect(() => {
    if (processo) {
      reset({
        title: processo.title,
        description: processo.description || '',
        priority: processo.priority,
        court: processo.court || '',
        courtCaseNumber: processo.courtCaseNumber || '',
        judge: processo.judge || '',
        opposingParty: processo.opposingParty || '',
        opposingLawyer: processo.opposingLawyer || '',
        feeType: (processo.feeType as any) || '',
        feeAmount: processo.feeAmount || undefined,
      })
    }
  }, [processo, reset])

  const toast = useToast()

  const onSubmit = async (data: UpdateProcessoData) => {
    const result = await mutate(data)
    if (result !== null) {
      toast.success('Processo actualizado')
      router.push(`/processos/${id}`)
    } else {
      toast.error('Erro ao actualizar processo')
    }
  }

  if (loadingProcesso) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-surface-raised rounded w-1/3" />
        <div className="bg-surface-raised p-6 space-y-4">
          <div className="h-12 bg-border rounded" />
          <div className="h-12 bg-border rounded" />
          <div className="h-12 bg-border rounded" />
        </div>
      </div>
    )
  }

  if (!processo) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4">
          Processo não encontrado
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/processos/${id}`}
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink">Editar Processo</h1>
          <p className="text-sm text-ink-muted mt-1">
            Tipo: {PROCESSO_TYPE_LABELS[processo.type]} (não pode ser alterado)
          </p>
        </div>
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
            />
            {errors.title && <p className="text-danger text-sm mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">Descricao</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">Prioridade</label>
            <select
              {...register('priority')}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            >
              <option value={ProcessoPriority.BAIXA}>Baixa</option>
              <option value={ProcessoPriority.MEDIA}>Media</option>
              <option value={ProcessoPriority.ALTA}>Alta</option>
            </select>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="font-display text-xl font-semibold text-ink mb-4">
              Informacoes do Tribunal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Tribunal
                </label>
                <input
                  type="text"
                  {...register('court')}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Numero do Processo no Tribunal
                </label>
                <input
                  type="text"
                  {...register('courtCaseNumber')}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">Juiz</label>
                <input
                  type="text"
                  {...register('judge')}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Parte Contraria
                  </label>
                  <input
                    type="text"
                    {...register('opposingParty')}
                    className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Advogado da Parte Contraria
                  </label>
                  <input
                    type="text"
                    {...register('opposingLawyer')}
                    className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="font-display text-xl font-semibold text-ink mb-4">Honorarios</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Tipo de Honorario
                </label>
                <select
                  {...register('feeType')}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                >
                  <option value="">Selecione o tipo</option>
                  <option value="FIXO">Fixo</option>
                  <option value="HORA">Por Hora</option>
                  <option value="PERCENTAGEM">Percentagem</option>
                  <option value="PRO_BONO">Pro Bono</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Valor em AOA
                </label>
                <input
                  type="number"
                  {...register('feeAmount', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                />
              </div>
            </div>
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
              href={`/processos/${id}`}
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
