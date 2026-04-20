'use client'

/**
 * Atendimento form modal — cria ou edita um atendimento (lead/prospecto).
 *
 * Escopo mínimo deliberado: o atendimento vive antes do cliente existir,
 * por isso só captura dados-âncora (nome, contacto, assunto, fonte). A
 * qualificação completa acontece na conversão para Cliente + Processo.
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { Modal, Button, FormField, Input, Textarea, Select } from '@/components/ui'
import {
  AtendimentoSource,
  ATENDIMENTO_SOURCE_LABELS,
  ClienteType,
  ProcessoPriority,
} from '@kamaia/shared-types'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.nativeEnum(ClienteType),
  nif: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  description: z.string().optional(),
  source: z.nativeEnum(AtendimentoSource),
  priority: z.nativeEnum(ProcessoPriority).default(ProcessoPriority.MEDIA),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface MemberOption {
  id: string
  firstName: string
  lastName: string
}

export interface AtendimentoFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (a: { id: string }) => void
}

export function AtendimentoFormModal({
  open,
  onClose,
  onSuccess,
}: AtendimentoFormModalProps) {
  const toast = useToast()
  const { mutate, loading } = useMutation<FormData, { id: string }>(
    '/atendimentos',
    'POST',
  )
  const { data: members } = useApi<MemberOption[]>(open ? '/team/members' : null, [open])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: ClienteType.INDIVIDUAL,
      source: AtendimentoSource.WHATSAPP,
      priority: ProcessoPriority.MEDIA,
    },
  })

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const onSubmit = async (data: FormData) => {
    const payload: FormData = {
      ...data,
      assignedToId: data.assignedToId || undefined,
    }
    const result = await mutate(payload, {
      onError: (e) => toast.error(e.error),
    })
    if (result?.id) {
      toast.success('Atendimento registado')
      onSuccess?.({ id: result.id })
      reset()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Atendimento"
      description="Registe um contacto / prospecto antes de o converter em cliente."
      size="lg"
      closeOnBackdrop={false}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nome" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="Nome completo ou razão social"
              autoFocus
            />
          </FormField>

          <FormField label="Tipo" required>
            <Select {...register('type')}>
              <option value={ClienteType.INDIVIDUAL}>Individual</option>
              <option value={ClienteType.EMPRESA}>Empresa</option>
            </Select>
          </FormField>

          <FormField label="NIF">
            <Input {...register('nif')} placeholder="—" />
          </FormField>

          <FormField label="Telefone">
            <Input {...register('phone')} placeholder="+244 ..." />
          </FormField>

          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} placeholder="email@exemplo.com" />
          </FormField>

          <FormField label="Fonte" required>
            <Select {...register('source')}>
              {Object.entries(ATENDIMENTO_SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Assunto" required error={errors.subject?.message}>
          <Input
            {...register('subject')}
            placeholder="Ex: Despedimento sem justa causa — TechAngola"
          />
        </FormField>

        <FormField label="Descrição breve">
          <Textarea
            {...register('description')}
            rows={3}
            placeholder="O que é que o prospecto descreveu no primeiro contacto..."
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Prioridade">
            <Select {...register('priority')}>
              <option value={ProcessoPriority.ALTA}>Alta</option>
              <option value={ProcessoPriority.MEDIA}>Média</option>
              <option value={ProcessoPriority.BAIXA}>Baixa</option>
            </Select>
          </FormField>

          <FormField label="Atribuir a">
            <Select {...register('assignedToId')}>
              <option value="">— Ninguém (sem atribuir) —</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Notas internas">
          <Textarea
            {...register('notes')}
            rows={2}
            placeholder="Contexto, quem indicou, próximas acções..."
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Registar atendimento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
