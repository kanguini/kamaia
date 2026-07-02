'use client'

/**
 * Kamaia CLM — Configurações / Equipa.
 *
 * Lista memberships do tenant activo + convidar + alterar role + remover.
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Role, ROLE_LABELS } from '@kamaia/shared-types'

// GET /memberships devolve o Membership com o `user` aninhado
// (memberships.service.ts list → include user.select).
interface Member {
  id: string
  userId: string
  role: Role
  user: {
    email: string
    firstName: string | null
    lastName: string | null
  }
}

interface MembersResponse {
  data: Member[]
}

export default function EquipaPage() {
  const { data, refetch } = useApi<Member[] | MembersResponse>('/memberships')
  const members: Member[] = Array.isArray(data) ? data : data?.data ?? []
  const [showInvite, setShowInvite] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button leftIcon={<Plus size={14} />} onClick={() => setShowInvite(true)}>Convidar membro</Button>
      </div>

      {members.length === 0 ? (
        <div style={{ color: 'var(--k2-text-mute)' }}>Sem membros.</div>
      ) : (
        <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} onChanged={refetch} />
          ))}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function MemberRow({ member, onChanged }: { member: Member; onChanged: () => void }) {
  const [role, setRole] = useState<Role>(member.role)
  // A rota de role é PATCH /memberships/:id/role — /:id dava 404 e a
  // mudança "não pegava".
  const { mutate: changeRole, loading: changing } = useMutation(`/memberships/${member.id}/role`, 'PATCH')
  const { mutate: remove, loading: removing } = useMutation(`/memberships/${member.id}`, 'DELETE')
  const nome = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.email

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderTop: '1px solid var(--k2-border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{nome}</div>
        <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{member.user.email}</div>
      </div>
      <Select
        value={role}
        onChange={async (e) => {
          const newRole = e.target.value as Role
          setRole(newRole)
          const r = await changeRole({ role: newRole })
          // Optimistic com revert: em falha volta ao valor real.
          if (!r) setRole(member.role)
          onChanged()
        }}
        style={{ width: 180 }}
        disabled={changing}
      >
        {Object.values(Role).map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </Select>
      <Button
        variant="ghost"
        size="sm"
        loading={removing}
        onClick={async () => {
          if (!confirm(`Remover ${nome} da equipa?`)) return
          await remove()
          onChanged()
        }}
        aria-label="Remover"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>(Role.BUSINESS_USER)
  // O convite é POST /memberships (a rota /memberships/invite não existe → 404).
  const { mutate, loading, error } = useMutation('/memberships', 'POST')

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
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Convidar membro</h2>
        {error && <div style={{ color: 'var(--k2-bad)', fontSize: 12 }}>{error}</div>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
          Role
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            loading={loading}
            onClick={async () => {
              const r = await mutate({ email, role })
              if (r) onInvited()
            }}
          >
            Enviar convite
          </Button>
        </div>
      </div>
    </div>
  )
}
