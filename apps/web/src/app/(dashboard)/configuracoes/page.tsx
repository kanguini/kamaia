'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  User, Building2, Lock, Bell, Mail, Smartphone,
  AlertTriangle, Download, Shield, Database, Save,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { Button, Switch, Input, FormField } from '@/components/ui'

// ── Interfaces ──────────────────────────────────────────

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  oaaNumber: string | null
  specialty: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
}

interface GabineteInfo {
  id: string
  name: string
  nif: string | null
  address: string | null
  phone: string | null
  email: string | null
  plan: string
}

interface NotificationPreferences {
  emailEnabled: boolean
  smsEnabled: boolean
  smsOnlyUrgent: boolean
}

// ── Section Component ───────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-ink-muted" />
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      <div className="bg-surface-raised border border-border rounded-2xl p-6">
        {children}
      </div>
    </section>
  )
}

// ── Profile Section ─────────────────────────────────────

function ProfileSection() {
  const { data: session } = useSession()
  const toast = useToast()
  const { data: profile, loading, refetch } = useApi<UserProfile>('/users/me')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    oaaNumber: '',
    specialty: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        oaaNumber: profile.oaaNumber || '',
        specialty: profile.specialty || '',
      })
    }
  }, [profile])

  const handleSave = async () => {
    if (!session?.accessToken) return
    setSaving(true)
    try {
      await api('/users/me', {
        method: 'PUT',
        body: JSON.stringify(form),
        token: session.accessToken,
      })
      toast.success('Perfil actualizado')
      refetch()
    } catch {
      toast.error('Erro ao actualizar perfil')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Section title="Perfil" icon={User}>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-border rounded-lg w-1/2" />
          <div className="h-10 bg-border rounded-lg w-1/3" />
        </div>
      </Section>
    )
  }

  return (
    <Section title="Perfil" icon={User}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nome">
            <Input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </FormField>
          <FormField label="Apelido">
            <Input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </FormField>
        </div>

        <FormField label="Email">
          <Input value={profile?.email || ''} disabled className="opacity-60" />
          <p className="text-xs text-ink-muted mt-1">O email nao pode ser alterado</p>
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Telefone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+244 9XX XXX XXX"
            />
          </FormField>
          <FormField label="N.o OAA">
            <Input
              value={form.oaaNumber}
              onChange={(e) => setForm({ ...form, oaaNumber: e.target.value })}
              placeholder="OAA-XXXX-XXXX"
            />
          </FormField>
          <FormField label="Especialidade">
            <Input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="Ex: Direito Civil"
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-xs text-ink-muted">
            <span className="font-medium text-ink">{profile?.role}</span> &middot; Desde {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-AO') : ''}
          </div>
          <Button onClick={handleSave} loading={saving} size="sm">
            <Save className="w-4 h-4 mr-1" />
            Guardar
          </Button>
        </div>
      </div>
    </Section>
  )
}

// ── Password Section ────────────────────────────────────

function PasswordSection() {
  const { data: session } = useSession()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const handleChange = async () => {
    if (form.newPassword !== form.confirmPassword) {
      toast.error('As passwords nao coincidem')
      return
    }
    if (form.newPassword.length < 8) {
      toast.error('A nova password deve ter pelo menos 8 caracteres')
      return
    }
    if (!session?.accessToken) return

    setSaving(true)
    try {
      await api('/users/me/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
        token: session.accessToken,
      })
      toast.success('Password alterada com sucesso')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e: any) {
      toast.error(e?.error || 'Erro ao alterar password')
    }
    setSaving(false)
  }

  return (
    <Section title="Alterar Password" icon={Lock}>
      <div className="space-y-4 max-w-md">
        <FormField label="Password actual">
          <Input
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
        </FormField>
        <FormField label="Nova password">
          <Input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            placeholder="Minimo 8 caracteres"
          />
        </FormField>
        <FormField label="Confirmar nova password">
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
        </FormField>
        <Button
          onClick={handleChange}
          loading={saving}
          disabled={!form.currentPassword || !form.newPassword || !form.confirmPassword}
          size="sm"
        >
          Alterar Password
        </Button>
      </div>
    </Section>
  )
}

// ── Gabinete Section ────────────────────────────────────

function GabineteSection() {
  const { data: session } = useSession()
  const toast = useToast()
  const { data: gabinete, loading, refetch } = useApi<GabineteInfo>('/gabinetes/current')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    nif: '',
    address: '',
    phone: '',
    email: '',
  })

  const isSocio = (session?.user as any)?.role === 'SOCIO_GESTOR'

  useEffect(() => {
    if (gabinete) {
      setForm({
        name: gabinete.name || '',
        nif: gabinete.nif || '',
        address: gabinete.address || '',
        phone: gabinete.phone || '',
        email: gabinete.email || '',
      })
    }
  }, [gabinete])

  const handleSave = async () => {
    if (!session?.accessToken) return
    setSaving(true)
    try {
      await api('/gabinetes/current', {
        method: 'PUT',
        body: JSON.stringify(form),
        token: session.accessToken,
      })
      toast.success('Gabinete actualizado')
      refetch()
    } catch {
      toast.error('Erro ao actualizar gabinete')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Section title="Gabinete" icon={Building2}>
        <div className="animate-pulse h-20 bg-border rounded-lg" />
      </Section>
    )
  }

  return (
    <Section title="Gabinete" icon={Building2}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nome do Gabinete">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!isSocio}
            />
          </FormField>
          <FormField label="NIF">
            <Input
              value={form.nif}
              onChange={(e) => setForm({ ...form, nif: e.target.value })}
              disabled={!isSocio}
            />
          </FormField>
        </div>
        <FormField label="Endereco">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            disabled={!isSocio}
          />
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Telefone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={!isSocio}
            />
          </FormField>
          <FormField label="Email">
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!isSocio}
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs font-mono px-2 py-1 bg-surface text-ink-muted rounded">
            Plano: {gabinete?.plan || 'FREE'}
          </span>
          {isSocio && (
            <Button onClick={handleSave} loading={saving} size="sm">
              <Save className="w-4 h-4 mr-1" />
              Guardar
            </Button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ── Notifications Section ───────────────────────────────

function NotificationsSection() {
  const { data: session } = useSession()
  const toast = useToast()
  const { data: prefs, loading, refetch } = useApi<NotificationPreferences>(
    '/notifications/preferences',
  )

  const handleUpdate = async (update: Partial<NotificationPreferences>) => {
    if (!session?.accessToken) return
    try {
      await api('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(update),
        token: session.accessToken,
      })
      toast.success('Preferencia actualizada')
      refetch()
    } catch {
      toast.error('Erro ao actualizar preferencia')
    }
  }

  if (loading) {
    return (
      <Section title="Notificacoes" icon={Bell}>
        <div className="animate-pulse h-20 bg-border rounded-lg" />
      </Section>
    )
  }

  if (!prefs) {
    return (
      <Section title="Notificacoes" icon={Bell}>
        <p className="text-ink-muted text-sm">Sem configuracoes de notificacao disponiveis.</p>
      </Section>
    )
  }

  return (
    <Section title="Notificacoes" icon={Bell}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">Email</p>
              <p className="text-xs text-ink-muted">Receba alertas de prazos por email</p>
            </div>
          </div>
          <Switch
            label="Email"
            checked={prefs.emailEnabled}
            onCheckedChange={(v) => handleUpdate({ emailEnabled: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">SMS</p>
              <p className="text-xs text-ink-muted">Receba alertas criticos por SMS</p>
            </div>
          </div>
          <Switch
            label="SMS"
            checked={prefs.smsEnabled}
            onCheckedChange={(v) => handleUpdate({ smsEnabled: v })}
          />
        </div>

        {prefs.smsEnabled && (
          <div className="flex items-center justify-between ml-7">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-ink-muted" />
              <div>
                <p className="text-sm font-medium text-ink">Apenas urgentes</p>
                <p className="text-xs text-ink-muted">SMS so para prazos urgentes</p>
              </div>
            </div>
            <Switch
              label="Apenas urgentes"
              checked={prefs.smsOnlyUrgent}
              onCheckedChange={(v) => handleUpdate({ smsOnlyUrgent: v })}
            />
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Data & Security Section ─────────────────────────────

function DataSection() {
  const toast = useToast()

  return (
    <Section title="Dados e Seguranca" icon={Shield}>
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Download className="w-4 h-4 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">Exportar Dados</p>
              <p className="text-xs text-ink-muted">Download de todos os dados em JSON</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/backup/export`, '_blank')
              toast.info('A preparar export...')
            }}
          >
            Exportar
          </Button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">Integridade</p>
              <p className="text-xs text-ink-muted">Verificacao diaria automatica</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded font-medium">
            Activo
          </span>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">Audit Log</p>
              <p className="text-xs text-ink-muted">Todas as accoes registadas</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded font-medium">
            Activo
          </span>
        </div>
      </div>
    </Section>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function ConfiguracoesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <h1 className="text-2xl font-semibold text-ink mb-6">Configuracoes</h1>

      <ProfileSection />
      <PasswordSection />
      <GabineteSection />
      <NotificationsSection />
      <DataSection />
    </div>
  )
}
