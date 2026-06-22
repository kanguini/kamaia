'use client'

/**
 * Kamaia CLM — Novo contrato.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { MOEDAS_SUPORTADAS, PaginatedResponse } from '@kamaia/shared-types'

const schema = z.object({
  titulo: z.string().min(2, 'Título obrigatório'),
  tipoId: z.string().min(1, 'Selecciona o tipo'),
  descricao: z.string().optional(),
  carteiraId: z.string().optional(),
  valor: z.string().optional(), // centavos as string to safely round-trip BigInt
  moeda: z.string().optional(),
  leiAplicavel: z.string().optional(),
  foro: z.string().optional(),
  dataAssinatura: z.string().optional(),
  dataInicioVigencia: z.string().optional(),
  dataTermo: z.string().optional(),
  renovacaoAutomatica: z.boolean().optional(),
  janelaDenunciaDias: z.string().optional(),
  responsavelId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface OptionItem {
  id: string
  nome: string
}

interface MembershipUser {
  userId: string
  firstName: string
  lastName: string
}

interface MembershipResponse {
  data: MembershipUser[]
}

export default function NovoContratoPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [tipos, setTipos] = useState<OptionItem[]>([])
  const [carteiras, setCarteiras] = useState<OptionItem[]>([])
  const [responsaveis, setResponsaveis] = useState<MembershipUser[]>([])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { moeda: 'AOA', renovacaoAutomatica: false },
  })

  const { mutate, loading, error } = useMutation<unknown, { id: string }>('/contratos', 'POST')

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    Promise.all([
      api<PaginatedResponse<OptionItem>>('/tipos-contrato?limit=100', { token: session.accessToken }),
      api<PaginatedResponse<OptionItem>>('/carteiras?limit=100', { token: session.accessToken }),
      api<MembershipResponse>('/memberships', { token: session.accessToken }),
    ])
      .then(([t, c, m]) => {
        setTipos(t.data ?? [])
        setCarteiras(c.data ?? [])
        setResponsaveis(m.data ?? [])
      })
      .catch(() => {
        /* tolerate partial load */
      })
  }, [session?.accessToken, status])

  const onSubmit = async (data: FormData) => {
    // Convert valor (kwanzas as user-friendly decimal) → BigInt centavos.
    // The form lets users type "150000.50" → 15_000_050 centavos.
    let valorCentavos: string | undefined
    if (data.valor) {
      const parsed = Number(data.valor.replace(',', '.'))
      if (Number.isFinite(parsed)) {
        valorCentavos = String(Math.round(parsed * 100))
      }
    }
    const payload = {
      titulo: data.titulo,
      tipoId: data.tipoId,
      descricao: data.descricao || undefined,
      carteiraId: data.carteiraId || undefined,
      valor: valorCentavos,
      moeda: data.moeda || undefined,
      leiAplicavel: data.leiAplicavel || undefined,
      foro: data.foro || undefined,
      dataAssinatura: data.dataAssinatura || undefined,
      dataInicioVigencia: data.dataInicioVigencia || undefined,
      dataTermo: data.dataTermo || undefined,
      renovacaoAutomatica: data.renovacaoAutomatica ?? false,
      janelaDenunciaDias: data.janelaDenunciaDias ? Number(data.janelaDenunciaDias) : undefined,
      responsavelId: data.responsavelId || undefined,
    }
    const result = await mutate(payload)
    if (result?.id) router.push(`/contratos/${result.id}`)
  }

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Novo contrato</h1>
        <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
          Cria um contrato e completa os detalhes nas tabs depois.
        </p>
      </header>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 16 }}>
        <Field label="Título" error={errors.titulo?.message}>
          <Input {...register('titulo')} placeholder="Ex.: Prestação de serviços de auditoria" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Tipo de contrato" error={errors.tipoId?.message}>
            <Select {...register('tipoId')}>
              <option value="">Selecciona…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </Select>
          </Field>
          <Field label="Carteira (opcional)">
            <Select {...register('carteiraId')}>
              <option value="">Nenhuma</option>
              {carteiras.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Descrição">
          <Textarea rows={3} {...register('descricao')} placeholder="Resumo curto do objecto contratual." />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Valor (em kwanzas, ex.: 150000.50)">
            <Input {...register('valor')} placeholder="0.00" />
          </Field>
          <Field label="Moeda">
            <Select {...register('moeda')}>
              {MOEDAS_SUPORTADAS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Lei aplicável">
            <Input {...register('leiAplicavel')} placeholder="Ex.: Direito angolano" />
          </Field>
          <Field label="Foro">
            <Input {...register('foro')} placeholder="Ex.: Tribunal da Comarca de Luanda" />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Field label="Data assinatura">
            <Input type="date" {...register('dataAssinatura')} />
          </Field>
          <Field label="Início vigência">
            <Input type="date" {...register('dataInicioVigencia')} />
          </Field>
          <Field label="Data termo">
            <Input type="date" {...register('dataTermo')} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
          <Field label="Janela de denúncia (dias)">
            <Input type="number" {...register('janelaDenunciaDias')} placeholder="Ex.: 60" />
          </Field>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--k2-text-dim)' }}>
            <input type="checkbox" {...register('renovacaoAutomatica')} />
            Renovação automática
          </label>
        </div>

        <Field label="Responsável">
          <Select {...register('responsavelId')}>
            <option value="">Eu</option>
            {responsaveis.map((u) => (
              <option key={u.userId} value={u.userId}>{u.firstName} {u.lastName}</option>
            ))}
          </Select>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Criar contrato
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--k2-bad)' }}>{error}</span>}
    </label>
  )
}
