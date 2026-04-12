'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { ProcessoType, ClienteType, PaginatedResponse } from '@kamaia/shared-types'

const PROCESSO_TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Civel',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Familia',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}

const createProcessoSchema = z.object({
  type: z.nativeEnum(ProcessoType, { required_error: 'Tipo e obrigatorio' }),
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente e obrigatorio'),
  court: z.string().optional(),
  courtCaseNumber: z.string().optional(),
  judge: z.string().optional(),
  opposingParty: z.string().optional(),
  opposingLawyer: z.string().optional(),
  feeType: z.enum(['FIXO', 'HORA', 'PERCENTAGEM', 'PRO_BONO']).optional(),
  feeAmount: z.number().optional(),
})

type CreateProcessoData = z.infer<typeof createProcessoSchema>

interface Cliente {
  id: string
  name: string
  type: ClienteType
  nif: string | null
}

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[...Array(totalSteps)].map((_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono font-medium transition-colors',
              i + 1 === currentStep
                ? 'bg-ink text-white'
                : i + 1 < currentStep
                  ? 'bg-success text-white'
                  : 'bg-border text-ink-muted',
            )}
          >
            {i + 1 < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={cn(
                'w-12 h-0.5 transition-colors',
                i + 1 < currentStep ? 'bg-success' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NovoProcessoPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const { data: clientesData } = useApi<PaginatedResponse<Cliente>>('/clientes?limit=100')
  const { mutate, loading, error } = useMutation<CreateProcessoData, { id: string }>(
    '/processos',
    'POST',
  )

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateProcessoData>({
    resolver: zodResolver(createProcessoSchema),
  })

  const formData = watch()
  const clientes = clientesData?.data || []

  const onSubmit = async (data: CreateProcessoData) => {
    const result = await mutate(data)
    if (result?.id) {
      router.push(`/processos/${result.id}`)
    }
  }

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 5))
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1))

  const canProceed = () => {
    if (step === 1) return formData.type && formData.title
    if (step === 2) return formData.clienteId
    return true
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/processos"
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-4xl font-semibold text-ink">Novo Processo</h1>
      </div>

      <div className="bg-surface-raised p-6">
        <StepIndicator currentStep={step} totalSteps={5} />

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger  p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-ink mb-4">Tipo & Titulo</h2>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Tipo de Processo <span className="text-danger">*</span>
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
                  {Object.entries(PROCESSO_TYPE_LABELS).map(([value, label]) => (
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
                  placeholder="Ex: Accao de Despejo"
                />
                {errors.title && <p className="text-danger text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Descricao
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
                  placeholder="Breve descricao do processo"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-ink mb-4">Cliente</h2>

              {clientes.length === 0 ? (
                <div className="bg-warning/10 border border-warning/20  p-6 text-center">
                  <p className="text-warning mb-4">Nenhum cliente registado</p>
                  <Link
                    href="/clientes/novo"
                    className="inline-flex items-center gap-2 bg-ink text-white font-medium px-6 py-2.5  hover:bg-[#1a1a1a] transition-colors"
                  >
                    Criar Cliente Primeiro
                  </Link>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Selecione o Cliente <span className="text-danger">*</span>
                  </label>
                  <select
                    {...register('clienteId')}
                    className={cn(
                      'w-full px-4 py-2.5 bg-surface border  transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                      errors.clienteId ? 'border-danger' : 'border-border',
                    )}
                  >
                    <option value="">Selecione um cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.name} ({cliente.type}) {cliente.nif ? `- ${cliente.nif}` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.clienteId && (
                    <p className="text-danger text-sm mt-1">{errors.clienteId.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-ink mb-4">Tribunal</h2>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Tribunal
                </label>
                <input
                  type="text"
                  {...register('court')}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                  placeholder="Ex: Tribunal Provincial de Luanda"
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
                  placeholder="Ex: 1234/2024"
                />
              </div>

              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">Juiz</label>
                <input
                  type="text"
                  {...register('judge')}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                  placeholder="Nome do juiz"
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
                    placeholder="Nome da parte contraria"
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
                    placeholder="Nome do advogado"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-ink mb-4">Honorarios</h2>

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
                  Valor em AKZ
                </label>
                <input
                  type="number"
                  {...register('feeAmount', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-ink mb-4">Confirmar</h2>

              <div className="bg-surface  p-6 space-y-4">
                <div>
                  <p className="text-xs font-mono text-ink-muted uppercase mb-1">Tipo</p>
                  <p className="text-ink font-medium">
                    {formData.type ? PROCESSO_TYPE_LABELS[formData.type] : '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-mono text-ink-muted uppercase mb-1">Titulo</p>
                  <p className="text-ink font-medium">{formData.title || '—'}</p>
                </div>

                {formData.description && (
                  <div>
                    <p className="text-xs font-mono text-ink-muted uppercase mb-1">Descricao</p>
                    <p className="text-ink">{formData.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-mono text-ink-muted uppercase mb-1">Cliente</p>
                  <p className="text-ink font-medium">
                    {clientes.find((c) => c.id === formData.clienteId)?.name || '—'}
                  </p>
                </div>

                {formData.court && (
                  <div>
                    <p className="text-xs font-mono text-ink-muted uppercase mb-1">Tribunal</p>
                    <p className="text-ink">{formData.court}</p>
                  </div>
                )}

                {formData.feeType && (
                  <div>
                    <p className="text-xs font-mono text-ink-muted uppercase mb-1">Honorario</p>
                    <p className="text-ink">
                      {formData.feeType}
                      {formData.feeAmount ? ` - ${formData.feeAmount.toLocaleString()} AKZ` : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-4">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-2 px-6 py-2.5 border border-border  text-sm font-medium text-ink-muted hover:bg-surface transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 bg-ink text-white font-medium py-2.5 ',
                  'hover:bg-[#1a1a1a] transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                Proximo
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
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
                  'Criar Processo'
                )}
              </button>
            )}

            <Link
              href="/processos"
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
