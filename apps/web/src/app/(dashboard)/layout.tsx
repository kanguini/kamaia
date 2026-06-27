'use client'

/**
 * Kamaia CLM dashboard chrome — sidebar + topbar.
 *
 * Sidebar groups:
 *   Trabalho       Dashboard, Contratos, Entidades, Carteiras, Compliance, Importação
 *   Ferramentas    IA, Biblioteca (Templates / Cláusulas), Configurações
 *
 * Topbar carries: tenant switcher, theme toggle, user menu.
 */

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  FileText,
  Building2,
  ShieldCheck,
  BookOpen,
  Bell,
  CalendarDays,
  Settings,
  LogOut,
  ChevronDown,
  Check,
  CheckCheck,
  Menu,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useTenants } from '@/hooks/use-tenants'
import { ToastProvider } from '@/components/ui/toast'
import { Logo, LogoIcon } from '@/components/ui/logo'
import { TenantPlan } from '@kamaia/shared-types'
import {
  KamaiaAIProvider,
  useKamaiaAI,
} from '@/components/kamaia-ai/kamaia-ai-provider'
import { KamaiaAIPanel } from '@/components/kamaia-ai/kamaia-ai-panel'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  match?: (pathname: string) => boolean
}

// Sprint 3.1: navegação consolidada de 11 → 7 items.
// - Carteiras desce para /configuracoes (admin)
// - Alertas + Compliance fundem-se em Calendário/Análise
// - Templates + Cláusulas + Tipos fundem-se em /biblioteca
// - IA full-page legacy fica acessível mas fora do menu primário

const WORK_NAV: NavItem[] = [
  { label: 'Dr. Kamaia', href: '/', icon: Sparkles, match: (p) => p === '/' },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Contratos', href: '/contratos', icon: FileText },
  { label: 'Entidades', href: '/entidades', icon: Building2 },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, match: (p) => p.startsWith('/agenda') || p.startsWith('/alertas') },
  { label: 'Análise', href: '/compliance', icon: ShieldCheck },
]

const TOOLS_NAV: NavItem[] = [
  { label: 'Biblioteca', href: '/biblioteca', icon: BookOpen, match: (p) => p.startsWith('/biblioteca') },
  { label: 'Configurações', href: '/configuracoes/organizacao', icon: Settings, match: (p) => p.startsWith('/configuracoes') || p.startsWith('/carteiras') },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  // Persiste preferência colapsada por sessão para evitar reset
  // entre navegações. Default = expandido.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('kamaia-sidebar') === 'collapsed')
    } catch {}
  }, [])
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem('kamaia-sidebar', next ? 'collapsed' : 'expanded')
      } catch {}
      return next
    })
  }

  return (
    <ToastProvider>
      <KamaiaAIProvider>
        <div className={cn('k2-shell', collapsed && 'collapsed')}>
          <Sidebar
            pathname={pathname}
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            user={session?.user}
          />

          <div className="k2-main">
            <Topbar onBurger={() => setMobileOpen(true)} />
            <div style={{ padding: '1.25rem 1.5rem 2rem' }}>{children}</div>
          </div>

          {/* Side panel persistente da Kamaia AI — montado uma vez,
              acessível em qualquer página via ⌘+J ou botão no topbar. */}
          <KamaiaAIPanel />
        </div>
      </KamaiaAIProvider>
    </ToastProvider>
  )
}

function Sidebar({
  pathname,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  user,
}: {
  pathname: string
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  user?: { firstName?: string; lastName?: string; email?: string }
}) {
  const initials = useInitials(user)

  return (
    <aside className={cn('k2-sidebar', open && 'open', collapsed && 'collapsed')}>
      {/* Header limpo — só o logo. O toggle de recolher migrou para o
          rodapé (fundo-direita). */}
      <div className="k2-sb-head">
        <div className="k2-brand">
          <div className="k2-brand-logo" aria-label="Kamaia">
            {collapsed ? <LogoIcon size={22} /> : <Logo height={20} />}
          </div>
        </div>
      </div>

      <nav className="k2-nav-group">
        {!collapsed && <div className="k2-nav-label">Trabalho</div>}
        {WORK_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} collapsed={collapsed} />
        ))}
        {!collapsed && (
          <div className="k2-nav-label" style={{ marginTop: 8 }}>
            Ferramentas
          </div>
        )}
        {TOOLS_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} collapsed={collapsed} />
        ))}
      </nav>

      {/* Rodapé — avatar do utilizador + organização activa, com o botão
          de recolher (chevron minimalista) ao fundo-direita. */}
      <div className="k2-sb-foot">
        <UserMenu user={user} initials={initials} direction="up" />
        {!collapsed && (
          <div className="k2-sb-foot-org">
            <TenantSwitcher direction="up" />
          </div>
        )}
        <button
          className="k2-sb-collapse"
          onClick={() => {
            if (open) onClose()
            else onToggleCollapsed()
          }}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}

function NavLink({
  item,
  pathname,
  onClick,
  collapsed,
}: {
  item: NavItem
  pathname: string
  onClick?: () => void
  collapsed?: boolean
}) {
  const Icon = item.icon
  const active = item.match
    ? item.match(pathname)
    : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className={cn('k2-nav-item', active && 'active')}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

function Topbar({ onBurger }: { onBurger: () => void }) {
  return (
    <header className="k2-topbar">
      <button
        className="k2-icon-btn k2-mobile-burger"
        onClick={onBurger}
        aria-label="Abrir menu"
      >
        <Menu size={16} />
      </button>

      <div style={{ flex: 1 }} />

      <div className="k2-topbar-actions">
        <GlobalSearch />
        <KamaiaAIToggle />
        <NotificationsBell />
      </div>
    </header>
  )
}

/**
 * Botão ✨ no topbar — abre/fecha o Kamaia AI side panel.
 * O atalho ⌘+J / Ctrl+J está ligado globalmente pelo provider.
 */
function KamaiaAIToggle() {
  const { open, toggle } = useKamaiaAI()
  return (
    <button
      className={cn('k2-icon-btn', open && 'active')}
      onClick={toggle}
      aria-label={open ? 'Fechar Dr. Kamaia' : 'Abrir Dr. Kamaia'}
      aria-pressed={open}
      title={open ? 'Fechar Dr. Kamaia (⌘+J)' : 'Abrir Dr. Kamaia (⌘+J)'}
      style={open ? { color: 'var(--k2-text)' } : undefined}
    >
      <Sparkles size={16} />
    </button>
  )
}

interface NotificationItem {
  id: string
  tipo: string
  titulo: string
  conteudo: string
  status: string
  payload?: { contratoId?: string; entidadeId?: string } | null
  createdAt: string
}

/**
 * Sino de notificações no topbar — substitui o antigo toggle de tema
 * (que migrou para Configurações). Mostra contagem de não-lidas e um
 * dropdown com as notificações recentes do utilizador. Clicar marca
 * como lida e navega para o contrato associado (se houver).
 */
function NotificationsBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const token = session?.accessToken
  const unread = items.filter((n) => n.status !== 'READ').length

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<{ data: NotificationItem[] }>(
        '/notifications?limit=20',
        { token },
      )
      setItems(res.data ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token])

  // Carrega ao montar e em polling discreto (90s) para refrescar o badge.
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 90_000)
    return () => clearInterval(t)
  }, [load])

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const onItemClick = async (n: NotificationItem) => {
    if (n.status !== 'READ' && token) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, status: 'READ' } : x)),
      )
      try {
        await api(`/notifications/${n.id}/read`, { method: 'PATCH', token })
      } catch {
        /* badge reverte no próximo load */
      }
    }
    const contratoId = n.payload?.contratoId
    setOpen(false)
    if (contratoId) router.push(`/contratos/${contratoId}`)
  }

  const markAllRead = async () => {
    const naoLidas = items.filter((n) => n.status !== 'READ')
    if (naoLidas.length === 0 || !token) return
    setItems((prev) => prev.map((x) => ({ ...x, status: 'READ' })))
    await Promise.allSettled(
      naoLidas.map((n) =>
        api(`/notifications/${n.id}/read`, { method: 'PATCH', token }),
      ),
    )
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className={cn('k2-icon-btn', open && 'active')}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        title="Notificações"
        style={open ? { color: 'var(--k2-text)' } : undefined}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              minWidth: 15,
              height: 15,
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--k2-bad)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              lineHeight: 1,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            width: 340,
            maxHeight: 440,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border-strong)',
            borderRadius: 'var(--k2-radius)',
            boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: '1px solid var(--k2-border)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--k2-text-mute)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <CheckCheck size={12} /> Marcar todas
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--k2-text-mute)' }}>
                A carregar…
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--k2-text-mute)' }}>
                <Bell size={20} style={{ opacity: 0.4 }} />
                <div style={{ fontSize: 12, marginTop: 8 }}>Sem notificações.</div>
              </div>
            ) : (
              items.map((n) => {
                const lida = n.status === 'READ'
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void onItemClick(n)}
                    style={{
                      display: 'flex',
                      gap: 9,
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: lida ? 'transparent' : 'var(--k2-bg-elev-2)',
                      border: 'none',
                      borderBottom: '1px solid var(--k2-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        marginTop: 5,
                        flexShrink: 0,
                        background: lida ? 'transparent' : 'var(--k2-accent)',
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: lida ? 400 : 600, color: 'var(--k2-text)' }}>
                        {n.titulo}
                      </span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--k2-text-mute)', marginTop: 2, lineHeight: 1.4 }}>
                        {n.conteudo}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Pesquisa global — apenas o ícone lupa junto às outras acções do
 * topbar. Click abre overlay com input centrado. Enter submete e
 * navega para /contratos?search=Q. ESC fecha.
 */
function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const submit = () => {
    if (q.trim()) {
      window.location.href = `/contratos?search=${encodeURIComponent(q.trim())}`
    }
  }

  return (
    <>
      <button
        className="k2-icon-btn"
        onClick={() => setOpen(true)}
        aria-label="Pesquisar"
        title="Pesquisar (⌘K)"
      >
        <Search size={16} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 92vw)',
              background: 'var(--k2-bg-elev)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius)',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 24px 60px -20px rgba(0,0,0,0.4)',
            }}
          >
            <Search size={16} style={{ color: 'var(--k2-text-mute)', marginLeft: 4 }} />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Procurar contratos, entidades…"
              aria-label="Pesquisa global"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--k2-text)',
                fontSize: 15,
                fontFamily: 'inherit',
                padding: '8px 4px',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--k2-text-mute)', padding: '2px 6px', border: '1px solid var(--k2-border)', borderRadius: 4 }}>
              ESC
            </span>
          </div>
        </div>
      )}
    </>
  )
}

function TenantSwitcher({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  const { tenants, active, switchTenant, loading } = useTenants()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const up = direction === 'up'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (loading) {
    return (
      <div style={{ fontSize: 13, color: 'var(--k2-text-mute)' }}>A carregar…</div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--k2-text-mute)' }}>
        Sem organização activa
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 10px',
          borderRadius: 'var(--k2-radius-sm)',
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border)',
          color: 'var(--k2-text)',
          fontSize: 13,
          cursor: 'pointer',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.nome ?? 'Selecciona organização'}
        </span>
        {active?.plan === TenantPlan.AGENCY && (
          <span style={{ fontSize: 10, color: 'var(--k2-accent)', letterSpacing: '0.06em', flexShrink: 0 }}>AGENCY</span>
        )}
        <ChevronDown size={13} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            ...(up ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            left: 0,
            right: 0,
            minWidth: 220,
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border-strong)',
            borderRadius: 'var(--k2-radius)',
            padding: 4,
            boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)',
            zIndex: 50,
          }}
        >
          {tenants.map((t) => {
            const isActive = active?.id === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  if (!isActive) switchTenant(t.id)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--k2-text)',
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.nome}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--k2-text-dim)' }}>
                    {t.plan} · {t.role}
                  </div>
                </div>
                {isActive && <Check size={14} style={{ color: 'var(--k2-accent)' }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UserMenu({
  user,
  initials,
  direction = 'down',
}: {
  user?: { firstName?: string; lastName?: string; email?: string }
  initials: string
  direction?: 'up' | 'down'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const up = direction === 'up'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Utilizador'

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px 4px 4px',
          borderRadius: 999,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="Menu do utilizador"
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--k2-accent)',
            color: 'var(--k2-accent-fg)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {initials}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            ...(up ? { left: 0, bottom: 'calc(100% + 6px)' } : { right: 0, top: 'calc(100% + 6px)' }),
            minWidth: 220,
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border-strong)',
            borderRadius: 'var(--k2-radius)',
            padding: 6,
            boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)',
            zIndex: 50,
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--k2-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{displayName}</div>
            {user?.email && (
              <div style={{ fontSize: 11, color: 'var(--k2-text-dim)' }}>{user.email}</div>
            )}
          </div>
          <Link
            href="/configuracoes/organizacao"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              color: 'var(--k2-text-dim)',
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            <Settings size={14} />
            Configurações
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              color: 'var(--k2-bad)',
              fontSize: 13,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

function useInitials(user?: { firstName?: string; lastName?: string; email?: string }): string {
  if (!user) return 'U'
  const first = user.firstName?.[0]
  const last = user.lastName?.[0]
  if (first && last) return (first + last).toUpperCase()
  if (first) return first.toUpperCase()
  if (user.email) return user.email.slice(0, 2).toUpperCase()
  return 'U'
}
