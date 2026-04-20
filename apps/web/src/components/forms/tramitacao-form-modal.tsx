'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Zap, ClipboardList, Sparkles } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  TramitacaoAutor,
  TRAMITACAO_AUTOR_LABELS,
  type ActoTypeDefinition,
  type TramitacaoTemplate,
} from '@kamaia/shared-types'

// ── 3 caminhos de registo: Template (~10s) · Rápida (~30s) · Completa ──

type EntryPath = 'template' | 'quick' | 'full'

interface Vocabulary {
  actoTypes: ActoTypeDefinition[]
  categoryLabels: Record<string, string>
  autorLabels: Record<string, string>
  templates: TramitacaoTemplate[]
}

// Schema único, com campos opcionais para que cada caminho preencha
// apenas o que precisa. Os 3 submetem ao mesmo endpoint (ou a /from-template).
const tramitacaoSchema = z.object({
  autor: z.nativeEnum(TramitacaoAutor),
  actoType: z.string().min(1, 'Tipo obrigatório'),
  title: z.string().min(1, 'Título obrigatório').max(300),
  description: z.string().optional(),
  actoDate: z.string().min(1, 'Data obrigatória'),
})

type TramitacaoFormData = z.infer<typeof tramitacaoSchema>

interface TramitacaoFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  processoId: string
}

export function TramitacaoFormModal({
  open,
  onClose,
  onSuccess,
  processoId,
}: TramitacaoFormModalProps) {
  const [path, setPath] = useState<EntryPath>('template')
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('')
  const toast = useToast()

  const { data: vocab, loading: vocabLoading } = useApi<Vocabulary>(
    open ? '/tramitacoes/vocabulary' : null,
  )

  const { mutate: createCustom, loading: creating } = useMutation<
    Record<string, unknown>,
    { id: string }
  >('/tramitacoes', 'POST')
  const { mutate: createFromTemplate, loading: templating } = useMutation<
    { processoId: string; templateKey: string; actoDate: string },
    { id: string }
  >('/tramitacoes/from-template', 'POST')

  const today = new Date().toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TramitacaoFormData>({
    resolver: zodResolver(tramitacaoSchema),
    defaultValues: {
      actoDate: today,
      autor: TramitacaoAutor.NOS,
    },
  })

  const watchedActoType = watch('actoType')

  // Agrupar tipos de acto por categoria para UI
  const categorized = useMemo(() => {
    if (!vocab) return [] as Array<{ category: string; label: string; items: ActoTypeDefinition[] }>
    const groups: Record<string, ActoTypeDefinition[]> = {}
    for (const a of vocab.actoTypes) {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category].push(a)
    }
    return Object.entries(groups).map(([category, items]) => ({
      category,
      label: vocab.categoryLabels[category] ?? category,
      items,
    }))
  }, [vocab])

  const handleClose = () => {
    reset({ actoDate: today, autor: TramitacaoAutor.NOS })
    setSelectedTemplateKey('')
    setPath('template')
    onClose()
  }

  // Caminho Template: preencher com os defaults do template selecionado
  const applyTemplate = (tpl: TramitacaoTemplate) => {
    setSelectedTemplateKey(tpl.key)
    setValue('actoType', tpl.actoType)
    setValue('autor', tpl.autor)
    setValue('title', tpl.defaultTitle)
    if (tpl.defaultDescription) setValue('description', tpl.defaultDescription)
  }

  // Submit: caminho Template (sem overrides) chama endpoint dedicado;
  // caminho Rápida/Completa submete custom.
  const onSubmit = async (data: TramitacaoFormData) => {
    if (path === 'template' && selectedTemplateKey) {
      const result = await createFromTemplate({
        processoId,
        templateKey: selectedTemplateKey,
        actoDate: data.actoDate,
      })
      if (result) {
        toast.success('Tramitação registada via template')
        onSuccess?.()
        handleClose()
      } else {
        toast.error('Erro ao registar tramitação')
      }
      return
    }

    const result = await createCustom({
      processoId,
      autor: data.autor,
      actoType: data.actoType,
      title: data.title,
      description: data.description || undefined,
      actoDate: data.actoDate,
    })

    if (result) {
      toast.success('Tramitação registada')
      onSuccess?.()
      handleClose()
    } else {
      toast.error('Erro ao registar tramitação')
    }
  }

  const loading = creating || templating

  return (
    <Modal open={open} onClose={handleClose} title="Registar Acto Processual" size="lg">
      {/* Selector de caminho — Template / Rápida / Completa */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <PathButton
          active={path === 'template'}
          onClick={() => setPath('template')}
          icon={Zap}
          label="Template"
          hint="≈ 10s"
        />
        <PathButton
          active={path === 'quick'}
          onClick={() => {
            setPath('quick')
            setSelectedTemplateKey('')
          }}
          icon={Sparkles}
          label="Rápida"
          hint="≈ 30s"
        />
        <PathButton
          active={path === 'full'}
          onClick={() => {
            setPath('full')
            setSelectedTemplateKey('')
          }}
          icon={ClipboardList}
          label="Completa"
          hint="com descrição"
        />
      </div>

      {vocabLoading && (
        <div className="flex items-center gap-2 text-ink-muted text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> A carregar vocabulário…
        </div>
      )}

      {!vocabLoading && vocab && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Caminho Template — grelha de templates com automações visíveis */}
          {path === 'template' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                Actos recorrentes com automações (pode gerar Prazo e avançar fase).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vocab.templates.map((tpl) => {
                  const isSelected = selectedTemplateKey === tpl.key
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={cn(
                        'text-left p-3 border transition-colors',
                        isSelected
                          ? 'border-ink bg-surface-raised'
                          : 'border-border bg-surface hover:bg-surface-raised',
                      )}
                    >
                      <p className="font-medium text-sm text-ink">{tpl.label}</p>
                      <p className="text-xs text-ink-muted font-mono mt-0.5">
                        {TRAMITACAO_AUTOR_LABELS[tpl.autor]}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tpl.generatePrazo && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/20 rounded-full">
                            + Prazo {tpl.generatePrazo.daysAfter}d
                          </span>
                        )}
                        {tpl.advanceToStage && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-info/10 text-info border border-info/20 rounded-full">
                            → {tpl.advanceToStage}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Data do acto (obrigatória mesmo no template) */}
              <div>
                <label className="block text-sm font-mono font-medium text-ink mb-2">
                  Data do acto <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  {...register('actoDate')}
                  className={cn(
                    'w-full px-4 py-2.5 bg-surface border transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                    errors.actoDate ? 'border-danger' : 'border-border',
                  )}
                />
                {errors.actoDate && (
                  <p className="text-danger text-sm mt-1">{errors.actoDate.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Caminho Rápida — apenas tipo, autor, título, data */}
          {(path === 'quick' || path === 'full') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Tipo de acto <span className="text-danger">*</span>
                  </label>
                  <select
                    {...register('actoType')}
                    className={cn(
                      'w-full px-4 py-2.5 bg-surface border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                      errors.actoType ? 'border-danger' : 'border-border',
                    )}
                  >
                    <option value="">Selecione…</option>
                    {categorized.map((group) => (
                      <optgroup key={group.category} label={group.label}>
                        {group.items.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {errors.actoType && (
                    <p className="text-danger text-sm mt-1">{errors.actoType.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Autor <span className="text-danger">*</span>
                  </label>
                  <select
                    {...register('autor')}
                    className={cn(
                      'w-full px-4 py-2.5 bg-surface border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                      errors.autor ? 'border-danger' : 'border-border',
                    )}
                  >
                    {Object.values(TramitacaoAutor).map((a) => (
                      <option key={a} value={a}>
                        {TRAMITACAO_AUTOR_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Título <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('title')}
                    placeholder={
                      watchedActoType
                        ? vocab.actoTypes.find((a) => a.key === watchedActoType)?.label
                        : 'Ex: Contestação apresentada'
                    }
                    className={cn(
                      'w-full px-4 py-2.5 bg-surface border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                      errors.title ? 'border-danger' : 'border-border',
                    )}
                  />
                  {errors.title && (
                    <p className="text-danger text-sm mt-1">{errors.title.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Data do acto <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('actoDate')}
                    className={cn(
                      'w-full px-4 py-2.5 bg-surface border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                      errors.actoDate ? 'border-danger' : 'border-border',
                    )}
                  />
                  {errors.actoDate && (
                    <p className="text-danger text-sm mt-1">{errors.actoDate.message}</p>
                  )}
                </div>
              </div>

              {/* Caminho Completa — descrição livre */}
              {path === 'full' && (
                <div>
                  <label className="block text-sm font-mono font-medium text-ink mb-2">
                    Descrição / notas
                  </label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    placeholder="Notas processuais, referências a documentos juntos, observações…"
                    className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={
                loading || (path === 'template' && !selectedTemplateKey)
              }
              className={cn(
                'flex-1 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5',
                'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A registar…
                </>
              ) : (
                'Registar Acto'
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 border border-border text-sm font-medium text-ink-muted hover:bg-surface transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function PathButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 p-3 border transition-colors text-center',
        active
          ? 'border-ink bg-surface-raised text-ink'
          : 'border-border bg-surface text-ink-muted hover:text-ink hover:bg-surface-raised',
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[10px] font-mono opacity-70">{hint}</span>
    </button>
  )
}

