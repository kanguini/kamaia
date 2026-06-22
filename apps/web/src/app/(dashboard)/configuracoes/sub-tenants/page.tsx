'use client'

/**
 * Kamaia CLM — Configurações / Sub-tenants (AGENCY only).
 *
 * Para sociedades de advogados que oferecem CLM-as-a-service aos seus clientes.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useTenants } from '@/hooks/use-tenants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TenantPlan, TenantStatus } from '@kamaia/shared-types'
import { useRouter } from 'next/navigation'

interface SubTenant {
  id: string
  nome: string
  nif: string | null
  status: TenantStatus
  plan: TenantPlan
  criadoEm: string
}

export default function SubTenantsPage() {
  const router = useRouter()
  const { active, loading: tenantLoading } = useTenants()
  const isAgency = active?.plan === TenantPlan.AGENCY

  const { data, refetch } = useApi<SubTenant[]>(isAgency ? '/tenants/sub-tenants' : null)
  const [showCreate, setShowCreate] = useState(false)

  if (tenantLoading) return <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>
  if (!isAgency) {
    return (
      <div style={{ color: 'var(--k2-text-mute)' }}>
        Esta área está disponível apenas para tenants no plano <strong>AGENCY</strong>.
      </div>
    )
  }

  const subs = data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Novo sub-tenant</Button>
      </div>

      {subs.length === 0 ? (
        <div style={{ color: 'var(--k2-text-mute)' }}>Ainda não tens sub-tenants.</div>
      ) : (
        <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
          {subs.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderTop: '1px solid var(--k2-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
                  {s.nif ?? '—'} · {s.plan}
                </div>
              </div>
              <Badge variant={s.status === TenantStatus.ACTIVE ? 'success' : 'default'}>{s.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            refetch()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState('')
  const [nif, setNif] = useState('')
  const { mutate, loading, error } = useMutation('/tenants/sub-tenants', 'POST')

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border-strong)',
          borderRadius: 'var(--k2-radius)',
          padding: 20,
          width: 'min(480px, 92vw)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Novo sub-tenant</h2>
        {error && <div style={{ color: 'var(--k2-bad)', fontSize: 12 }}>{error}</div>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
          Nome
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
          NIF (opcional)
          <Input value={nif} onChange={(e) => setNif(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            loading={loading}
            onClick={async () => {
              const r = await mutate({ nome, nif: nif || undefined })
              if (r) onCreated()
            }}
          >
            Criar
          </Button>
        </div>
      </div>
    </div>
  )
}
