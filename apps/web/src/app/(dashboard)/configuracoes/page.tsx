'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Mail, Bell, Smartphone, AlertTriangle } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { cn } from '@/lib/utils'

interface NotificationPreferences {
  emailEnabled: boolean
  smsEnabled: boolean
  smsOnlyUrgent: boolean
}

interface TestResult {
  email?: { status: string }
  push?: { status: string }
  sms?: { status: string }
}

interface ToggleCardProps {
  title: string
  description: string
  icon: React.ElementType
  enabled: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  helpText?: string
  inset?: boolean
}

function Switch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        enabled ? 'bg-amber' : 'bg-border',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

function ToggleCard({
  title,
  description,
  icon: Icon,
  enabled,
  onChange,
  disabled,
  helpText,
  inset,
}: ToggleCardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-border rounded-xl p-4 flex items-start gap-4',
        inset && 'ml-8 bg-bone/30',
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', disabled && 'opacity-50')}>
        <Icon className="w-5 h-5 text-ink" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-ink font-medium mb-1">{title}</h3>
        <p className="text-muted text-sm">{description}</p>
        {helpText && <p className="text-error text-xs mt-1">{helpText}</p>}
      </div>
      <Switch enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function ConfiguracoesPage() {
  const { data: session } = useSession()
  const { data: prefs, loading, error, refetch } = useApi<NotificationPreferences>(
    '/notifications/preferences',
  )
  const { mutate: updatePrefs, loading: updating } = useMutation<
    Partial<NotificationPreferences>,
    NotificationPreferences
  >('/notifications/preferences', 'PUT')
  const { mutate: sendTest, loading: testing } = useMutation<void, TestResult>(
    '/notifications/test',
    'POST',
  )
  const { status: pushStatus, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const handleUpdatePref = async (update: Partial<NotificationPreferences>) => {
    const result = await updatePrefs(update)
    if (result) refetch()
  }

  const handlePushToggle = async (value: boolean) => {
    if (value) {
      await subscribe()
    } else {
      await unsubscribe()
    }
  }

  const handleTest = async () => {
    const result = await sendTest()
    if (result) setTestResult(result)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-semibold text-ink mb-8">Configuracoes</h1>
        <div className="bg-bone rounded-xl p-8 text-center">
          <p className="text-muted">A carregar configuracoes...</p>
        </div>
      </div>
    )
  }

  if (error || !prefs) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-semibold text-ink mb-8">Configuracoes</h1>
        <div className="bg-error/10 border border-error/20 rounded-xl p-8 text-center">
          <p className="text-error">{error || 'Erro ao carregar configuracoes'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-4xl font-semibold text-ink mb-8">Configuracoes</h1>

      {/* Perfil Section */}
      <section className="mb-10">
        <h2 className="font-display text-2xl font-semibold text-ink mb-4">Perfil</h2>
        <div className="bg-white border border-border rounded-xl p-6 space-y-4">
          <div>
            <p className="text-xs font-mono text-muted uppercase mb-1">Nome</p>
            <p className="text-ink">
              {session?.user?.firstName} {session?.user?.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs font-mono text-muted uppercase mb-1">Email</p>
            <p className="text-ink">{session?.user?.email}</p>
          </div>
          <div>
            <p className="text-xs font-mono text-muted uppercase mb-1">Tipo de Utilizador</p>
            <p className="text-ink">{session?.user?.role}</p>
          </div>
          {(session?.user as { oaaNumber?: string })?.oaaNumber && (
            <div>
              <p className="text-xs font-mono text-muted uppercase mb-1">Numero OAA</p>
              <p className="text-ink font-mono">{(session?.user as { oaaNumber?: string })?.oaaNumber}</p>
            </div>
          )}
        </div>
      </section>

      {/* Notificacoes Section */}
      <section>
        <h2 className="font-display text-2xl font-semibold text-ink mb-4">
          Preferencias de Notificacoes
        </h2>
        <div className="space-y-4">
          <ToggleCard
            title="Notificacoes por Email"
            description="Receba alertas de prazos por email"
            icon={Mail}
            enabled={prefs.emailEnabled}
            onChange={(v) => handleUpdatePref({ emailEnabled: v })}
          />

          <ToggleCard
            title="Notificacoes Push"
            description="Receba alertas no browser mesmo com a aplicacao fechada"
            icon={Bell}
            enabled={pushStatus === 'subscribed'}
            onChange={handlePushToggle}
            disabled={
              pushStatus === 'unsupported' || pushStatus === 'denied' || pushLoading || updating
            }
            helpText={
              pushStatus === 'unsupported'
                ? 'Browser nao suporta push notifications'
                : pushStatus === 'denied'
                  ? 'Permissao negada — active nas definicoes do browser'
                  : undefined
            }
          />

          <ToggleCard
            title="Notificacoes SMS"
            description="Receba alertas criticos por SMS"
            icon={Smartphone}
            enabled={prefs.smsEnabled}
            onChange={(v) => handleUpdatePref({ smsEnabled: v })}
          />

          {prefs.smsEnabled && (
            <ToggleCard
              title="SMS apenas para prazos urgentes"
              description="Limita SMS a prazos marcados como urgentes"
              icon={AlertTriangle}
              enabled={prefs.smsOnlyUrgent}
              onChange={(v) => handleUpdatePref({ smsOnlyUrgent: v })}
              inset
            />
          )}

          <div className="border-t border-border pt-6 mt-8">
            <button
              onClick={handleTest}
              disabled={testing}
              className={cn(
                'px-6 py-2.5 bg-ink text-bone rounded-lg hover:bg-ink/80 transition-colors font-medium',
                testing && 'opacity-50 cursor-not-allowed',
              )}
            >
              {testing ? 'A enviar...' : 'Enviar notificacao de teste'}
            </button>
            {testResult && (
              <div className="mt-4 bg-bone rounded-lg p-4">
                <p className="text-xs font-mono text-muted uppercase mb-2">Resultado do Teste</p>
                <div className="space-y-1 text-sm">
                  {testResult.email && (
                    <p>
                      <span className="font-medium">Email:</span>{' '}
                      <span
                        className={
                          testResult.email.status === 'sent' ? 'text-success' : 'text-error'
                        }
                      >
                        {testResult.email.status}
                      </span>
                    </p>
                  )}
                  {testResult.push && (
                    <p>
                      <span className="font-medium">Push:</span>{' '}
                      <span
                        className={
                          testResult.push.status === 'sent' ? 'text-success' : 'text-error'
                        }
                      >
                        {testResult.push.status}
                      </span>
                    </p>
                  )}
                  {testResult.sms && (
                    <p>
                      <span className="font-medium">SMS:</span>{' '}
                      <span
                        className={testResult.sms.status === 'sent' ? 'text-success' : 'text-error'}
                      >
                        {testResult.sms.status}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
