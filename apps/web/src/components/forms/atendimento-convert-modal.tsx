'use client'

/**
 * Converte um atendimento num Cliente + Processo.
 *
 * Dois modos:
 *   - "novo cliente"   (default): herda os dados do atendimento; permite override.
 *   - "cliente existente":       liga o processo a um cliente já registado.
 *
 * Em ambos, o processo é criado com título/tipo/descrição preenchidos pelo
 * advogado — normalmente com base no `subject` do atendimento, que já é
 * pré-carregado como sugestão.
 */

import { useEffect, useState } from 'react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { Modal, Button, FormField, Input, Textarea, Select } from '@/components/ui'
import { ProcessoType, ProcessoPriority } from '@kamaia/shared-types'

interface ClienteOption {
  id: string
  name: string
  nif: string | null
}

interface AtendimentoSummary {
  id: string
  name: string
  type: 'INDIVIDUAL' | 'EMPRESA'
  nif: string | null
  email: string | null
  phone: string | null
  subject: string
  description: string | null
}

type ConvertPayload = {
  clienteId?: string
  clienteOverride?: {
    name?: string
    nif?: string
    email?: string
    phone?: string
    address?: string
  }
  processo: {
    title: string
    type: ProcessoType
    description?: string
    priority: ProcessoPriority
  }
}

type ConvertResult = {
  clienteId: string
  processoId: string
  atendimentoId: string
}

export interface AtendimentoConvertModalProps {
  open: boolean
  onClose: () => void
  atendimento: AtendimentoSummary | null
  onSuccess?: (r: ConvertResult) => void
}

const PROCESSO_TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Cível',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Família',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}

export function AtendimentoConvertModal({
  open,
  onClose,
  atendimento,
  onSuccess,
}: AtendimentoConvertModalProps) {
  const toast = useToast()
  const { mutate, loading } = useMutation<ConvertPayload, ConvertResult>(
    atendimento ? `/atendimentos/${atendimento.id}/convert` : '',
    'POST',
  )

  const { data: clientesData } = useApi<{ data: ClienteOption[] }>(
    open ? '/clientes?limit=500' : null,
    [open],
  )
  const clientes = clientesData?.data ?? []

  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [clienteId, setClienteId] = useState('')

  // Cliente override (só relevante em modo "new") — pré-preenchido do atendimento.
  const [overrideName, setOverrideName] = useState('')
  const [overrideNif, setOverrideNif] = useState('')
  const [overrideEmail, setOverrideEmail] = useState('')
  const [overridePhone, setOverridePhone] = useState('')
  const [overrideAddress, setOverrideAddress] = useState('')

  // Processo
  const [procTitle, setProcTitle] = useState('')
  const [procType, setProcType] = useState<ProcessoType>(ProcessoType.CIVEL)
  const [procDescription, setProcDescription] = useState('')
  const [procPriority, setProcPriority] = useState<ProcessoPriority>(ProcessoPriority.MEDIA)

  useEffect(() => {
    if (open && atendimento) {
      setMode('new')
      setClienteId('')
      setOverrideName(atendimento.name)
      setOverrideNif(atendimento.nif ?? '')
      setOverrideEmail(atendimento.email ?? '')
      setOverridePhone(atendimento.phone ?? '')
      setOverrideAddress('')
      setProcTitle(atendimento.subject)
      setProcType(ProcessoType.CIVEL)
      setProcDescription(atendimento.description ?? '')
      setProcPriority(ProcessoPriority.MEDIA)
    }
  }, [open, atendimento])

  if (!atendimento) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!procTitle.trim()) {
      toast.error('Título do processo é obrigatório')
      return
    }
    if (mode === 'existing' && !clienteId) {
      toast.error('Seleccione um cliente existente')
      return
    }

    const payload: ConvertPayload = {
      processo: {
        title: procTitle.trim(),
        type: procType,
        description: procDescription.trim() || undefined,
        priority: procPriority,
      },
    }
    if (mode === 'existing') {
      payload.clienteId = clienteId
    } else {
      payload.clienteOverride = {
        name: overrideName.trim() || undefined,
        nif: overrideNif.trim() || undefined,
        email: overrideEmail.trim() || undefined,
        phone: overridePhone.trim() || undefined,
        address: overrideAddress.trim() || undefined,
      }
    }

    const result = await mutate(payload, { onError: (e) => toast.error(e.error) })
    if (result) {
      toast.success('Atendimento convertido')
      onSuccess?.(result)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Converter: ${atendimento.name}`}
      description="Cria o cliente (novo ou existente) e abre o processo na fase inicial."
      size="xl"
      closeOnBackdrop={false}
    >
      <form onSubmit={submit} className="space-y-6">
        {/* Mode selector */}
        <div>
          <div className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Cliente
          </div>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 px-4 py-2 text-sm border transition-colors ${
                mode === 'new'
                  ? 'border-ink bg-surface text-ink font-medium'
                  : 'border-border text-ink-muted hover:text-ink'
              }`}
            >
              Criar novo cliente
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 px-4 py-2 text-sm border transition-colors ${
                mode === 'existing'
                  ? 'border-ink bg-surface text-ink font-medium'
                  : 'border-border text-ink-muted hover:text-ink'
              }`}
            >
              Usar cliente existente
            </button>
          </div>

          {mode === 'existing' ? (
            <FormField label="Cliente" required>
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">— Seleccione um cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.nif ? `(${c.nif})` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nome">
                <Input
                  value={overrideName}
                  onChange={(e) => setOverrideName(e.target.value)}
                />
              </FormField>
              <FormField label="NIF">
                <Input
                  value={overrideNif}
                  onChange={(e) => setOverrideNif(e.target.value)}
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={overrideEmail}
                  onChange={(e) => setOverrideEmail(e.target.value)}
                />
              </FormField>
              <FormField label="Telefone">
                <Input
                  value={overridePhone}
                  onChange={(e) => setOverridePhone(e.target.value)}
                />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Endereço">
                  <Textarea
                    rows={2}
                    value={overrideAddress}
                    onChange={(e) => setOverrideAddress(e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>

        {/* Processo */}
        <div>
          <div className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Processo
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Título" required>
              <Input
                value={procTitle}
                onChange={(e) => setProcTitle(e.target.value)}
                placeholder="Ex: João Silva vs. TechAngola"
              />
            </FormField>
            <FormField label="Tipo" required>
              <Select
                value={procType}
                onChange={(e) => setProcType(e.target.value as ProcessoType)}
              >
                {Object.entries(PROCESSO_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Prioridade">
              <Select
                value={procPriority}
                onChange={(e) => setProcPriority(e.target.value as ProcessoPriority)}
              >
                <option value={ProcessoPriority.ALTA}>Alta</option>
                <option value={ProcessoPriority.MEDIA}>Média</option>
                <option value={ProcessoPriority.BAIXA}>Baixa</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Descrição inicial" className="mt-4">
            <Textarea
              rows={3}
              value={procDescription}
              onChange={(e) => setProcDescription(e.target.value)}
              placeholder="Contexto factual do processo..."
            />
          </FormField>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Converter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
