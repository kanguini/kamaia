'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Mail, Bell, Smartphone, AlertTriangle } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui'

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
        'bg-surface border border-border p-4 flex items-start gap-4',
        inset && 'ml-8 bg-surface-raised',
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', disabled && 'opacity-50')} aria-hidden="true">
        <Icon className="w-5 h-5 text-ink" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-ink font-medium mb-1">{title}</h3>
        <p className="text-ink-muted text-sm">{description}</p>
        {helpText && <p className="text-danger text-xs mt-1" role="alert">{helpText}</p>}
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled}
        label={title}
        description={description}
      />
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
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink mb-8">Configuracoes</h1>
        <div className="bg-surface-raised p-8 text-center" role="status" aria-live="polite">
          <p className="text-ink-muted">A carregar configuracoes...</p>
        </div>
      </div>
    )
  }

  if (error || !prefs) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink mb-8">Configuracoes</h1>
        <div className="bg-danger/10 border border-danger/20  p-8 text-center" role="alert">
          <p className="text-danger">{error || 'Erro ao carregar configuracoes'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink mb-8">Configuracoes</h1>

      {/* Perfil Section */}
      <section className="mb-10">
        <h2 className="font-display text-2xl font-semibold text-ink mb-4">Perfil</h2>
        <div className="bg-surface border border-border p-6 space-y-4">
          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Nome</p>
            <p className="text-ink">
              {session?.user?.firstName} {session?.user?.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Email</p>
            <p className="text-ink">{session?.user?.email}</p>
          </div>
          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-1">Tipo de Utilizador</p>
            <p className="text-ink">{session?.user?.role}</p>
          </div>
          {(session?.user as { oaaNumber?: string })?.oaaNumber && (
            <div>
              <p className="text-xs font-mono text-ink-muted uppercase mb-1">Numero OAA</p>
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
                'px-6 py-2.5 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]  hover:bg-ink/80 transition-colors font-medium',
                testing && 'opacity-50 cursor-not-allowed',
              )}
            >
              {testing ? 'A enviar...' : 'Enviar notificacao de teste'}
            </button>
            {testResult && (
              <div className="mt-4 bg-surface border border-border p-4">
                <p className="text-xs font-mono text-ink-muted uppercase mb-2">Resultado do Teste</p>
                <div className="space-y-1 text-sm">
                  {testResult.email && (
                    <p>
                      <span className="font-medium">Email:</span>{' '}
                      <span
                        className={
                          testResult.email.status === 'sent' ? 'text-success' : 'text-danger'
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
                          testResult.push.status === 'sent' ? 'text-success' : 'text-danger'
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
                        className={testResult.sms.status === 'sent' ? 'text-success' : 'text-danger'}
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
