'use client'

/**
 * Kamaia CLM — Configurações / Organização.
 * Edita os dados do Tenant activo.
 */

import { useEffect, useState } from 'react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useTheme } from '@/hooks/use-theme'
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

      <Preferencias />
    </div>
  )
}

/**
 * Preferências da UI — idioma + tema. Persistidas em localStorage
 * para sobreviverem a refresh. Idioma actualmente só suporta PT-AO
 * para o conteúdo da app (todas as strings estão hardcoded em PT);
 * a opção fica wired para quando rolar o i18n full (next-intl).
 */
function Preferencias() {
  const { theme, setTheme } = useTheme()
  const [idioma, setIdioma] = useState<'pt-AO' | 'en'>('pt-AO')
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kamaia-locale')
      if (saved === 'en' || saved === 'pt-AO') setIdioma(saved)
    } catch {}
  }, [])
  const onChange = (v: 'pt-AO' | 'en') => {
    setIdioma(v)
    try { localStorage.setItem('kamaia-locale', v) } catch {}
  }
  return (
    <div style={{
      marginTop: 24,
      paddingTop: 24,
      borderTop: '1px solid var(--k2-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Preferências da interface</h2>
        <p style={{ fontSize: 12, color: 'var(--k2-text-dim)', margin: '4px 0 0' }}>
          Idioma e tema usados apenas no teu utilizador.
        </p>
      </div>
      <Field label="Idioma">
        <select
          value={idioma}
          onChange={(e) => onChange(e.target.value as 'pt-AO' | 'en')}
          style={{
            padding: '8px 10px',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            color: 'var(--k2-text)',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          <option value="pt-AO">Português (Angola) — predefinido</option>
          <option value="en">English (preview)</option>
        </select>
        {idioma === 'en' && (
          <span style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 4 }}>
            Tradução completa para inglês ainda em curso — algumas
            strings continuam em português.
          </span>
        )}
      </Field>
      <Field label="Tema">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
          style={{
            padding: '8px 10px',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            color: 'var(--k2-text)',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
        </select>
      </Field>
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
