'use client'

/**
 * Kamaia CLM — Configurações / Webhooks.
 *
 * Permite ao tenant subscrever endpoints HTTPS para receber eventos
 * do produto (contrato.criado, contrato.assinado, acto detectado, etc).
 *
 * O `secret` HMAC é devolvido **uma única vez** na criação — depois disso
 * o backend só armazena o hash. UI tem de o exibir e copiar imediatamente.
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Copy, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const EVENTS_AVAILABLE = [
  'contrato.criado',
  'contrato.estado_alterado',
  'contrato.assinado',
  'contrato.expira_em_30_dias',
  'contrato.expira_em_7_dias',
  'contrato.janela_denuncia_proxima',
  'contrato.renovacao_automatica_proxima',
  'contrato.terminado',
  'acto_regulatorio.detectado',
  'acto_regulatorio.concluido',
] as const

interface Webhook {
  id: string
  nome: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: string
  _count?: { deliveries: number }
}

interface Delivery {
  id: string
  event: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING'
  responseStatus: number | null
  responseBody: string | null
  tentativas: number
  entregueEm: string | null
  proximaTentativa: string | null
  createdAt: string
}

interface WebhookDetail extends Webhook {
  deliveries: Delivery[]
}

const STATUS_COLORS: Record<Delivery['status'], string> = {
  PENDING: 'var(--k2-text-mute)',
  SUCCESS: '#10b981',
  FAILED: '#ef4444',
  RETRYING: '#f59e0b',
}

export default function WebhooksPage() {
  const { data, refetch } = useApi<Webhook[]>('/webhooks')
  const { data: session } = useSession()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null)

  const create = useMutation<{ nome: string; url: string; events: string[] }, Webhook & { secret: string }>(
    '/webhooks',
    'POST',
  )

  async function handleCreate(form: { nome: string; url: string; events: string[] }) {
    try {
      const created = await create.mutate(form)
      if (created) {
        setRevealedSecret({ id: created.id, secret: created.secret })
        setShowCreate(false)
        await refetch()
      }
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este webhook? Deliveries em curso serão canceladas.')) return
    if (!session?.accessToken) return
    try {
      await api(`/webhooks/${id}`, { method: 'DELETE', token: session.accessToken })
      await refetch()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const webhooks = data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ color: 'var(--k2-text-mute)', fontSize: 13, margin: 0, maxWidth: 620 }}>
          Webhooks notificam os teus sistemas quando eventos relevantes ocorrem.
          Cada chamada é assinada com HMAC SHA-256 — verifica o header{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 12 }}>X-Kamaia-Signature</code>{' '}
          contra o teu secret. Retries com backoff exponencial (1m → 24h, 6 tentativas).
        </p>
        <Button leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
          Novo webhook
        </Button>
      </div>

      {revealedSecret && (
        <RevealSecretBanner
          secret={revealedSecret.secret}
          onDismiss={() => setRevealedSecret(null)}
        />
      )}

      {webhooks.length === 0 ? (
        <div style={{ color: 'var(--k2-text-mute)', padding: 40, textAlign: 'center' }}>
          Ainda não tens webhooks. Cria o primeiro para receber eventos em HTTPS.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 480px' : '1fr', gap: 12 }}>
          <div
            style={{
              background: 'var(--k2-bg-elev)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius)',
              overflow: 'hidden',
            }}
          >
            {webhooks.map((w) => (
              <div
                key={w.id}
                onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 16px',
                  borderTop: '1px solid var(--k2-border)',
                  cursor: 'pointer',
                  background: w.id === selectedId ? 'var(--k2-bg-hover)' : 'transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 500 }}>
                    {w.nome}
                    {!w.isActive && <Badge>Desactivado</Badge>}
                  </div>
                  <div
                    style={{
                      color: 'var(--k2-text-mute)',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {w.url}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 360 }}>
                  {w.events.slice(0, 3).map((e) => (
                    <Badge key={e}>{e.replace('contrato.', '').replace('acto_regulatorio.', 'acto.')}</Badge>
                  ))}
                  {w.events.length > 3 && <Badge>+{w.events.length - 3}</Badge>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--k2-text-mute)', minWidth: 80, textAlign: 'right' }}>
                  {w._count?.deliveries ?? 0} entregas
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(w.id)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--k2-text-mute)',
                    padding: 4,
                  }}
                  aria-label="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {selectedId && (
            <WebhookDetail id={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
      )}

      {showCreate && <CreateWebhookModal onCreate={handleCreate} onCancel={() => setShowCreate(false)} />}
    </div>
  )
}

// ─── Reveal Secret Banner ─────────────────────────────────────

function RevealSecretBanner({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [shown, setShown] = useState(true)
  const [copied, setCopied] = useState(false)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard pode falhar em alguns browsers */
    }
  }

  return (
    <div
      style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 'var(--k2-radius)',
        padding: '16px 20px',
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
        Secret HMAC — copia agora, não volta a ser mostrado
      </div>
      <p style={{ color: 'var(--k2-text-mute)', fontSize: 12, margin: '0 0 12px 0' }}>
        Guarda este valor numa secret store. É usado para verificar a autenticidade de cada delivery
        via header <code style={{ fontFamily: 'monospace' }}>X-Kamaia-Signature</code>.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code
          style={{
            flex: 1,
            background: 'var(--k2-bg)',
            border: '1px solid var(--k2-border)',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 12,
            wordBreak: 'break-all',
            filter: shown ? 'none' : 'blur(6px)',
            userSelect: shown ? 'text' : 'none',
          }}
        >
          {secret}
        </code>
        <Button variant="ghost" leftIcon={shown ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setShown((s) => !s)}>
          {shown ? 'Ocultar' : 'Mostrar'}
        </Button>
        <Button leftIcon={<Copy size={14} />} onClick={copyToClipboard}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>Fechei</Button>
      </div>
    </div>
  )
}

// ─── Webhook Detail (deliveries) ──────────────────────────────

function WebhookDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, refetch, loading } = useApi<WebhookDetail>(`/webhooks/${id}`)

  return (
    <div
      style={{
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxHeight: 600,
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Últimas 50 entregas</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="ghost" leftIcon={<RefreshCw size={12} />} onClick={refetch}>
            Refrescar
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>A carregar…</div>
      ) : !data || data.deliveries.length === 0 ? (
        <div style={{ color: 'var(--k2-text-mute)', fontSize: 12, padding: 20, textAlign: 'center' }}>
          Sem entregas ainda. Cria um contrato para disparar o primeiro evento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.deliveries.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 10,
                background: 'var(--k2-bg)',
                border: '1px solid var(--k2-border)',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--k2-text)' }}>
                  {d.event}
                </code>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 4,
                    color: STATUS_COLORS[d.status],
                    background: STATUS_COLORS[d.status] + '20',
                  }}
                >
                  {d.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--k2-text-mute)' }}>
                <span>HTTP {d.responseStatus ?? '—'}</span>
                <span>{d.tentativas} tentativa{d.tentativas === 1 ? '' : 's'}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(d.createdAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              {d.responseBody && d.status === 'FAILED' && (
                <code
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    color: 'var(--k2-text-mute)',
                    background: 'rgba(239, 68, 68, 0.06)',
                    padding: 6,
                    borderRadius: 4,
                    maxHeight: 60,
                    overflow: 'auto',
                  }}
                >
                  {d.responseBody.slice(0, 200)}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Webhook Modal ─────────────────────────────────────

function CreateWebhookModal({
  onCreate,
  onCancel,
}: {
  onCreate: (form: { nome: string; url: string; events: string[] }) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['contrato.assinado', 'acto_regulatorio.detectado'])

  function toggle(event: string) {
    setEvents((cur) => (cur.includes(event) ? cur.filter((e) => e !== event) : [...cur, event]))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border)',
          borderRadius: 12,
          padding: 24,
          width: 'min(560px, 92vw)',
          maxHeight: '88vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 500, margin: '0 0 16px 0' }}>Novo webhook</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--k2-text-mute)', display: 'block', marginBottom: 4 }}>
              Nome
            </label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ERP sync · CRM sync · Audit pipeline ..."
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--k2-text-mute)', display: 'block', marginBottom: 4 }}>
              URL
            </label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://erp.empresa.ao/kamaia/hook"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--k2-text-mute)', display: 'block', marginBottom: 6 }}>
              Eventos a receber ({events.length} seleccionados)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {EVENTS_AVAILABLE.map((event) => (
                <label
                  key={event}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={events.includes(event)}
                    onChange={() => toggle(event)}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={() => onCreate({ nome, url, events })}
            disabled={!nome.trim() || !url.trim() || events.length === 0}
          >
            Criar webhook
          </Button>
        </div>
      </div>
    </div>
  )
}
