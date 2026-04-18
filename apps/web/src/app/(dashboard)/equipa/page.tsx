'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Users, UserPlus, Shield, Mail, MoreVertical,
  Key, X, Check,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { Button, Modal, EmptyState, LoadingSkeleton, FormField } from '@/components/ui'
import { cn } from '@/lib/utils'
import { KamaiaRole } from '@kamaia/shared-types'

interface Member {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  oaaNumber: string | null
  specialty: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  SOCIO_GESTOR: 'Socio Gestor',
  ADVOGADO_SOLO: 'Advogado Solo',
  ADVOGADO_MEMBRO: 'Advogado Membro',
  ESTAGIARIO: 'Estagiario',
}

const ROLE_COLORS: Record<string, string> = {
  SOCIO_GESTOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ADVOGADO_SOLO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ADVOGADO_MEMBRO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ESTAGIARIO: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export default function EquipaPage() {
  const { data: session } = useSession()
  const { data: members, loading, refetch } = useApi<Member[]>('/team/members')
  const [showInvite, setShowInvite] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const toast = useToast()

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: KamaiaRole.ADVOGADO_MEMBRO as string,
    oaaNumber: '',
    specialty: '',
  })

  const callApi = async (endpoint: string, method: string = 'POST', body?: unknown) => {
    if (!session?.accessToken) return null
    try {
      const result = await api<{ data: any }>(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        token: session.accessToken,
      })
      return result?.data || result
    } catch {
      return null
    }
  }

  const handleInvite = async () => {
    setInviting(true)
    const result = await callApi('/team/invite', 'POST', {
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      role: form.role,
      oaaNumber: form.oaaNumber || undefined,
      specialty: form.specialty || undefined,
    })
    if (result) {
      setTempPassword(result.tempPassword)
      setShowInvite(false)
      setForm({ email: '', firstName: '', lastName: '', role: KamaiaRole.ADVOGADO_MEMBRO, oaaNumber: '', specialty: '' })
      toast.success('Membro convidado com sucesso')
      refetch()
    } else {
      toast.error('Erro ao convidar membro')
    }
    setInviting(false)
  }

  const handleResetPassword = async (memberId: string) => {
    const result = await callApi(`/team/members/${memberId}/reset-password`)
    if (result) {
      setTempPassword(result.tempPassword)
      toast.success('Password resetada')
    } else {
      toast.error('Erro ao resetar password')
    }
    setMenuOpen(null)
  }

  const handleToggleActive = async (memberId: string, isActive: boolean) => {
    await callApi(`/team/members/${memberId}`, 'PUT', { isActive: !isActive })
    toast.success(isActive ? 'Membro desactivado' : 'Membro activado')
    refetch()
    setMenuOpen(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Equipa</h1>
          <p className="text-sm text-ink-muted mt-1">Gerir membros do gabinete</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/equipa/capacidade"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-surface-raised"
          >
            Capacidade
          </a>
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Convidar Membro
          </Button>
        </div>
      </div>

      {tempPassword && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Password temporaria gerada</p>
              <p className="mt-1 text-lg font-mono font-bold text-green-900 dark:text-green-200">{tempPassword}</p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Partilhe esta password com o membro. Sera solicitada a alteracao no primeiro login.
              </p>
            </div>
            <button onClick={() => setTempPassword(null)} className="text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : !members || members.length === 0 ? (
        <EmptyState icon={Users} title="Sem membros" description="Convide o primeiro membro da equipa" />
      ) : (
        <div className="grid gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className={cn(
                'flex items-center justify-between p-4 rounded-lg border border-border bg-surface',
                !member.isActive && 'opacity-50',
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-ink-muted font-medium text-sm">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{member.firstName} {member.lastName}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded', ROLE_COLORS[member.role])}>
                      <Shield className="w-3 h-3" />
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                    {!member.isActive && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-ink-muted">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {member.email}</span>
                    {member.oaaNumber && <span>OAA: {member.oaaNumber}</span>}
                    {member.specialty && <span>{member.specialty}</span>}
                  </div>
                </div>
              </div>
              <div className="relative">
                <button onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)} className="p-2 rounded hover:bg-surface-raised text-ink-muted">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen === member.id && (
                  <div className="absolute right-0 top-10 z-10 w-48 bg-surface border border-border rounded-lg shadow-lg py-1">
                    <button onClick={() => handleToggleActive(member.id, member.isActive)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink hover:bg-surface-raised">
                      {member.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {member.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleResetPassword(member.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink hover:bg-surface-raised">
                      <Key className="w-4 h-4" /> Reset Password
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Convidar Membro" description="Adicione um novo membro ao gabinete">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome" required>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink" placeholder="Nome" />
            </FormField>
            <FormField label="Apelido" required>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink" placeholder="Apelido" />
            </FormField>
          </div>
          <FormField label="Email" required>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink" placeholder="email@exemplo.ao" />
          </FormField>
          <FormField label="Perfil de Acesso" required>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink">
              <option value={KamaiaRole.ADVOGADO_MEMBRO}>Advogado Membro</option>
              <option value={KamaiaRole.ESTAGIARIO}>Estagiario</option>
              <option value={KamaiaRole.SOCIO_GESTOR}>Socio Gestor</option>
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="N.o OAA">
              <input type="text" value={form.oaaNumber} onChange={(e) => setForm({ ...form, oaaNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink" placeholder="Opcional" />
            </FormField>
            <FormField label="Especialidade">
              <input type="text" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink" placeholder="Ex: Direito Civil" />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !form.email || !form.firstName || !form.lastName}>
              {inviting ? 'A convidar...' : 'Convidar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
