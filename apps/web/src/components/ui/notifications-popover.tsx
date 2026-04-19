'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell, Check, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface NotificationItem {
  id: string
  type: string
  channel: string
  status: string
  subject: string | null
  body: string | null
  metadata: Record<string, unknown> | null
  sentAt: string | null
  readAt: string | null
  createdAt: string
}

interface ListResponse {
  data: {
    data: NotificationItem[]
    nextCursor: string | null
    total: number
  }
}

/**
 * Topbar notifications bell — opens a popover listing the 10 most recent
 * notifications for the current user. Each row can be clicked to mark as
 * read and navigate to the related entity (when metadata carries an
 * entity/id). A footer link goes to /configuracoes → notification prefs.
 */
export function NotificationsPopover({ hasUnread }: { hasUnread: boolean }) {
  const { data: session } = useSession()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Click outside / ESC → close
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Lazy-load notifications the first time the popover opens (and refresh
  // each open so the list stays current without a websocket).
  useEffect(() => {
    if (!open || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api<ListResponse>('/notifications?limit=10', { token: session.accessToken })
      .then((res) => {
        if (cancelled) return
        setItems(res.data.data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = (err as { error?: string }).error || 'Erro ao carregar notificações'
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, session?.accessToken])

  const markRead = async (id: string) => {
    if (!session?.accessToken) return
    try {
      await api(`/notifications/${id}/read`, {
        method: 'PATCH',
        token: session.accessToken,
      })
      setItems((prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) : prev,
      )
    } catch {
      /* non-fatal */
    }
  }

  const onItemClick = (n: NotificationItem) => {
    if (!n.readAt) markRead(n.id)
    // Try to route to the related entity if metadata tells us what it is.
    const meta = n.metadata || {}
    const entity = (meta as { entityType?: string }).entityType
    const entityId = (meta as { entityId?: string }).entityId
    if (entity && entityId) {
      const route = routeFor(entity, entityId)
      if (route) {
        setOpen(false)
        router.push(route)
        return
      }
    }
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={cn('k2-icon-btn', hasUnread && 'k2-notif-dot')}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        aria-expanded={open}
        aria-haspopup="menu"
        title={hasUnread ? 'Tens notificações não lidas' : 'Sem notificações'}
      >
        <Bell size={16} />
      </button>

      {open && (
        <div role="menu" className="k2-notif-pop">
          <header>
            <span>Notificações</span>
            <button
              type="button"
              className="k2-notif-pref"
              onClick={() => {
                setOpen(false)
                router.push('/configuracoes')
              }}
              title="Preferências de notificação"
              aria-label="Preferências de notificação"
            >
              <Settings2 size={14} />
            </button>
          </header>

          <div className="k2-notif-list">
            {loading && <div className="k2-notif-empty">A carregar…</div>}
            {error && !loading && <div className="k2-notif-empty">{error}</div>}
            {!loading && !error && items && items.length === 0 && (
              <div className="k2-notif-empty">Sem notificações recentes.</div>
            )}
            {!loading && !error &&
              items?.map((n) => {
                const unread = !n.readAt
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="menuitem"
                    onClick={() => onItemClick(n)}
                    className={cn('k2-notif-item', unread && 'unread')}
                  >
                    <div className="head">
                      <span className="subject">{n.subject || formatType(n.type)}</span>
                      {unread && <span className="dot" aria-hidden="true" />}
                    </div>
                    {n.body && <p className="body">{n.body}</p>}
                    <span className="time">{formatRelative(n.createdAt)}</span>
                  </button>
                )
              })}
          </div>

          <footer>
            <button
              type="button"
              className="k2-notif-markall"
              disabled={!items?.some((n) => !n.readAt)}
              onClick={async () => {
                if (!items) return
                const unread = items.filter((n) => !n.readAt)
                await Promise.all(unread.map((n) => markRead(n.id)))
              }}
            >
              <Check size={13} />
              <span>Marcar todas como lidas</span>
            </button>
          </footer>
        </div>
      )}

      <style jsx>{`
        .k2-notif-pop {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 340px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.4);
          z-index: 50;
          display: flex;
          flex-direction: column;
          max-height: min(520px, calc(100vh - 120px));
          overflow: hidden;
        }
        .k2-notif-pop header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--k2-border);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--k2-text-dim);
        }
        .k2-notif-pref {
          border: none;
          background: transparent;
          color: var(--k2-text-mute);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
        }
        .k2-notif-pref:hover {
          color: var(--k2-text);
          background: var(--k2-bg-hover);
        }
        .k2-notif-list {
          overflow-y: auto;
          flex: 1;
        }
        .k2-notif-empty {
          padding: 24px 14px;
          text-align: center;
          color: var(--k2-text-mute);
          font-size: 12px;
        }
        :global(.k2-notif-item) {
          display: flex;
          flex-direction: column;
          gap: 3px;
          width: 100%;
          padding: 10px 12px;
          text-align: left;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--k2-border);
          cursor: pointer;
          color: var(--k2-text);
          transition: background 120ms;
        }
        :global(.k2-notif-item:last-child) { border-bottom: none; }
        :global(.k2-notif-item:hover) { background: var(--k2-bg-hover); }
        :global(.k2-notif-item .head) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        :global(.k2-notif-item .subject) {
          font-size: 13px;
          font-weight: 500;
          color: var(--k2-text);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        :global(.k2-notif-item .dot) {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--k2-accent);
          flex-shrink: 0;
        }
        :global(.k2-notif-item .body) {
          font-size: 12px;
          color: var(--k2-text-dim);
          margin: 0;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        :global(.k2-notif-item .time) {
          font-size: 11px;
          color: var(--k2-text-mute);
        }
        :global(.k2-notif-item.unread .subject) { font-weight: 600; }
        .k2-notif-pop footer {
          padding: 8px 10px;
          border-top: 1px solid var(--k2-border);
        }
        .k2-notif-markall {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--k2-text-dim);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
        }
        .k2-notif-markall:hover:not(:disabled) {
          background: var(--k2-bg-hover);
          color: var(--k2-text);
        }
        .k2-notif-markall:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

// ─── Helpers ───

function formatType(t: string): string {
  const map: Record<string, string> = {
    PRAZO_ALERT: 'Alerta de prazo',
    PROCESSO_UPDATE: 'Actualização de processo',
    INVOICE_DUE: 'Factura por liquidar',
    TASK_ASSIGNED: 'Tarefa atribuída',
    MENTION: 'Menção',
  }
  return map[t] || t.replace(/_/g, ' ').toLowerCase()
}

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime()
  const now = Date.now()
  const s = Math.round((now - d) / 1000)
  if (s < 60) return 'agora mesmo'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  const day = Math.round(h / 24)
  if (day < 7) return `há ${day} d`
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

function routeFor(entity: string, id: string): string | null {
  switch (entity.toUpperCase()) {
    case 'PRAZO':
      return `/prazos/${id}`
    case 'PROCESSO':
      return `/processos/${id}`
    case 'INVOICE':
    case 'FACTURA':
      return `/facturas/${id}`
    case 'PROJECT':
    case 'PROJECTO':
      return `/projectos/${id}`
    case 'TASK':
    case 'TAREFA':
      return '/tarefas'
    case 'CLIENTE':
      return `/clientes/${id}`
    default:
      return null
  }
}
