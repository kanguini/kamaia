'use client'

/**
 * Kamaia CLM — Configurações / Organização.
 * Edita os dados do Tenant activo.
 */

import { useEffect, useState } from 'react'
import { useApi, useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TenantPlan, TenantStatus } from '@kamaia/shared-types'

interface Tenant {
  id: string
  nome: string
  nif: string | null
  email: string | null
  telefone: string | null
  morada: string | null
  plan: TenantPlan
  status: TenantStatus
}

export default function OrganizacaoPage() {
  const { data: tenant, refetch } = useApi<Tenant>('/tenants/current')
  const { mutate, loading, error } = useMutation('/tenants/current', 'PATCH')

  const [nome, setNome] = useState('')
  const [nif, setNif] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [morada, setMorada] = useState('')

  useEffect(() => {
    if (!tenant) return
    setNome(tenant.nome)
    setNif(tenant.nif ?? '')
    setEmail(tenant.email ?? '')
    setTelefone(tenant.telefone ?? '')
    setMorada(tenant.morada ?? '')
  }, [tenant])

  const onSave = async () => {
    const r = await mutate({
      nome,
      nif: nif || undefined,
      email: email || undefined,
      telefone: telefone || undefined,
      morada: morada || undefined,
    })
    if (r) refetch()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--k2-text-dim)' }}>
        <span>Plano: <strong style={{ color: 'var(--k2-text)' }}>{tenant?.plan}</strong></span>
        <span>·</span>
        <span>Estado: <strong style={{ color: 'var(--k2-text)' }}>{tenant?.status}</strong></span>
      </div>

      {error && <div style={{ color: 'var(--k2-bad)', fontSize: 12 }}>{error}</div>}

      <Field label="Nome">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="NIF">
        <Input value={nif} onChange={(e) => setNif(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Telefone">
        <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      </Field>
      <Field label="Morada">
        <Input value={morada} onChange={(e) => setMorada(e.target.value)} />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button loading={loading} onClick={onSave}>Guardar</Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)' }}>{label}</span>
      {children}
    </label>
  )
}
