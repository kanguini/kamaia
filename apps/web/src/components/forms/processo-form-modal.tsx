'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Scale, User, Building2, DollarSign, FileText } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { Modal, Button, FormField, Input, Textarea, Select } from '@/components/ui'
import { ProcessoType, ClienteType, PaginatedResponse } from '@kamaia/shared-types'

const PROCESSO_TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Cível',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Família',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}

const schema = z.object({
  type: z.nativeEnum(ProcessoType, { required_error: 'Tipo é obrigatório' }),
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  priority: z.enum(['ALTA', 'MEDIA', 'BAIXA']).default('MEDIA'),
  court: z.string().optional(),
  courtCaseNumber: z.string().optional(),
  judge: z.string().optional(),
  opposingParty: z.string().optional(),
  opposingLawyer: z.string().optional(),
  feeType: z.enum(['FIXO', 'HORA', 'PERCENTAGEM', 'PRO_BONO']).optional(),
  feeAmount: z.number().optional(),
})

type FormData = z.infer<typeof schema>

interface Cliente {
  id: string
  name: string
  type: ClienteType
  nif: string | null
}

export interface ProcessoFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (processo: { id: string }) => void
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border">
      <Icon className="w-4 h-4 text-ink-muted" />
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">{title}</h3>
    </div>
  )
}

export function ProcessoFormModal({ open, onClose, onSuccess }: ProcessoFormModalProps) {
  const toast = useToast()
  const { data: clientesData } = useApi<PaginatedResponse<Cliente>>(open ? '/clientes?limit=100' : null, [open])
  const { mutate, loading, error } = useMutation<FormData, { id: string }>('/processos', 'POST')
  const [feeType, setFeeType] = useState<string>('')

  const clientes = clientesData?.data || []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIA' },
  })

  const onSubmit = async (data: FormData) => {
    const result = await mutate(data)
    if (result?.id) {
      toast.success('Processo criado com sucesso')
      reset()
      onSuccess?.(result)
      onClose()
    } else {
      toast.error(error || 'Erro ao criar processo')
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo Processo"
      description="Criar um novo processo jurídico no sistema"
      size="xl"
      closeOnBackdrop={false}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Seção 1: Identificação */}
        <div>
          <SectionHeader icon={Scale} title="Identificação" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Tipo de Processo" required error={errors.type?.message}>
              <Select {...register('type')}>
                <option value="">Seleccione um tipo</option>
                {Object.entries(PROCESSO_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Prioridade">
              <Select {...register('priority')}>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Título" required error={errors.title?.message} className="mt-4">
            <Input
              {...register('title')}
              placeholder="Ex: João Silva vs. TechAngola — Despedimento ilícito"
            />
          </FormField>

          <FormField label="Descrição" className="mt-4">
            <Textarea
              {...register('description')}
              rows={3}
              placeholder="Breve descrição do processo..."
            />
          </FormField>
        </div>

        {/* Seção 2: Cliente */}
        <div>
          <SectionHeader icon={User} title="Cliente" />
          <FormField label="Cliente" required error={errors.clienteId?.message}>
            <Select {...register('clienteId')}>
              <option value="">Seleccione um cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.nif ? `(${c.nif})` : ''}
                </option>
              ))}
            </Select>
            {clientes.length === 0 && (
              <p className="text-xs text-ink-muted mt-1">
                Sem clientes. Crie um cliente primeiro.
              </p>
            )}
          </FormField>
        </div>

        {/* Seção 3: Tribunal (opcional) */}
        <div>
          <SectionHeader icon={Building2} title="Tribunal (opcional)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Tribunal">
              <Input {...register('court')} placeholder="Ex: Tribunal Provincial de Luanda" />
            </FormField>
            <FormField label="N.º do Processo no Tribunal">
              <Input {...register('courtCaseNumber')} placeholder="Ex: 123/2026" />
            </FormField>
            <FormField label="Juiz">
              <Input {...register('judge')} placeholder="Nome do juiz" />
            </FormField>
            <FormField label="Parte Contrária">
              <Input {...register('opposingParty')} placeholder="Nome da parte contrária" />
            </FormField>
          </div>
          <FormField label="Advogado da Parte Contrária" className="mt-4">
            <Input {...register('opposingLawyer')} placeholder="Nome do advogado oponente" />
          </FormField>
        </div>

        {/* Seção 4: Honorários (opcional) */}
        <div>
          <SectionHeader icon={DollarSign} title="Honorários (opcional)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Tipo de Honorários">
              <Select
                {...register('feeType')}
                onChange={(e) => setFeeType(e.target.value)}
              >
                <option value="">Não definido</option>
                <option value="FIXO">Valor Fixo</option>
                <option value="HORA">Por Hora</option>
                <option value="PERCENTAGEM">Percentagem</option>
                <option value="PRO_BONO">Pro Bono</option>
              </Select>
            </FormField>
            {feeType && feeType !== 'PRO_BONO' && (
              <FormField label={feeType === 'PERCENTAGEM' ? 'Percentagem (%)' : 'Valor (AKZ)'}>
                <Input
                  type="number"
                  step="0.01"
                  {...register('feeAmount', { valueAsNumber: true })}
                  placeholder={feeType === 'PERCENTAGEM' ? '10' : '100000'}
                />
              </FormField>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            <FileText className="w-4 h-4 mr-1" />
            Criar Processo
          </Button>
        </div>
      </form>
    </Modal>
  )
}
