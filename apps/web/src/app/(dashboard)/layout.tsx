'use client'

/**
 * Kamaia 2.0 dashboard chrome — sidebar + topbar.
 *
 * Faithful port of the Claude Design "kamaia-2-0/project/Dashboard.html"
 * prototype:
 *   - 248px sticky sidebar with brand mark + two nav groups + user chip
 *   - Thin accent bar on the active nav item (2px vertical stripe)
 *   - 60px topbar with crumb, centred ⌘K command trigger, notifications,
 *     theme toggle, primary "+ Novo" button
 *   - Borderless content area with generous horizontal padding
 */

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  LayoutDashboard, Scale, Users, Calendar, Clock, FileText, Timer, Receipt,
  Bot, Settings, LogOut, Sun, Moon, CheckSquare, Briefcase, Banknote,
  ChevronDown, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { useTheme } from '@/hooks/use-theme'
import { ToastProvider } from '@/components/ui/toast'
import { NewDropdownButton } from '@/components/ui/new-dropdown'
import { GlobalSearch } from '@/components/ui/global-search'
import { AIButton } from '@/components/ui/ai-button'
import { Logo } from '@/components/ui/logo'
import { NotificationsPopover } from '@/components/ui/notifications-popover'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  countEndpoint?: string
  countPath?: string
}

// Primary work nav + secondary tools nav.
const WORK_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Projectos', href: '/projectos', icon: Briefcase, countEndpoint: '/projects?status=ACTIVO&limit=1', countPath: 'total' },
  { label: 'Processos', href: '/processos', icon: Scale, countEndpoint: '/processos?status=ACTIVO&limit=1', countPath: 'total' },
  { label: 'Clientes', href: '/clientes', icon: Users, countEndpoint: '/clientes?limit=1', countPath: 'total' },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Prazos', href: '/prazos', icon: Clock },
  { label: 'Documentos', href: '/documentos', icon: FileText },
  { label: 'Timesheets', href: '/timesheets', icon: Timer },
  { label: 'Despesas', href: '/despesas', icon: Receipt },
  { label: 'Facturas', href: '/facturas', icon: Banknote },
  { label: 'Tarefas', href: '/tarefas', icon: CheckSquare },
]

const TOOLS_NAV: NavItem[] = [
  { label: 'IA Assistente', href: '/ia-assistente', icon: Bot },
  { label: 'Equipa', href: '/equipa', icon: Users },
]

// ─────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Unread notifications dot
  const { data: unread } = useApi<{ count: number }>(
    session?.accessToken ? '/notifications/unread-count' : null,
  )
  const hasUnread = (unread?.count ?? 0) > 0

  const crumb = useMemo(() => computeCrumb(pathname), [pathname])

  return (
    <ToastProvider>
      <style jsx global>{`
        /* Kamaia 2.0 — base reset scoped to the dashboard shell */
        html, body {
          background: var(--k2-bg);
          color: var(--k2-text);
          overflow-x: hidden;       /* never let any child cause a page-level horizontal scroll */
          max-width: 100vw;
        }
        body { font-feature-settings: 'tnum', 'zero'; letter-spacing: -0.005em; }

        .k2-shell {
          display: grid;
          grid-template-columns: var(--k2-sidebar-w) minmax(0, 1fr);
          min-height: 100vh;
          width: 100%;
          max-width: 100vw;
          background: var(--k2-bg);
          color: var(--k2-text);
          font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        }

        /* ─── Sidebar ─── */
        .k2-sidebar {
          background: var(--k2-bg-elev);
          border-right: 1px solid var(--k2-border);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
        }
        .k2-sb-head {
          padding: 18px 18px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .k2-brand {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          min-width: 0;
        }
        .k2-brand-logo {
          display: inline-flex;
          color: var(--k2-text);
          line-height: 0;
        }
        .k2-brand-sub {
          font-size: 10px;
          color: var(--k2-text-dim);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
        .k2-ws-btn {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          color: var(--k2-text-mute);
          border-radius: 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 120ms;
        }
        .k2-ws-btn:hover {
          color: var(--k2-text);
          background: var(--k2-bg-hover);
        }
        .k2-nav-group {
          padding: 6px 10px;
          overflow-y: auto;
          flex: 1;
        }
        .k2-nav-label {
          font-size: 10px;
          color: var(--k2-text-dim);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px 8px 6px;
        }
        .k2-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 10px;
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          font-size: 13px;
          cursor: pointer;
          position: relative;
          width: 100%;
          text-align: left;
          transition: background 120ms ease, color 120ms ease;
          text-decoration: none;
        }
        .k2-nav-item:hover {
          background: var(--k2-bg-hover);
        }
        .k2-nav-item.active {
          background: var(--k2-bg-hover);
          color: var(--k2-text);
        }
        .k2-nav-item.active::before {
          content: '';
          position: absolute;
          left: -10px;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 16px;
          background: var(--k2-accent);
          border-radius: 2px;
        }
        .k2-nav-item svg {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          color: var(--k2-text);
        }
        .k2-nav-count {
          margin-left: auto;
          font-size: 11px;
          font-variant-numeric: tabular-nums;
          font-weight: 500;
          color: var(--k2-text);
          background: var(--k2-bg-elev-2);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .k2-nav-item:not(.active) .k2-nav-count {
          color: var(--k2-text-dim);
        }

        .k2-sb-foot {
          margin-top: auto;
          padding: 12px;
          border-top: 1px solid var(--k2-border);
        }
        .k2-user-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          transition: background 120ms;
          position: relative;
        }
        .k2-user-chip:hover { background: var(--k2-bg-hover); }
        .k2-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6b7a89, #384049);
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          flex-shrink: 0;
        }
        .k2-user-meta {
          min-width: 0;
          flex: 1;
        }
        .k2-user-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--k2-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .k2-user-mail {
          font-size: 11px;
          color: var(--k2-text-mute);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .k2-icon-btn {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          color: var(--k2-text-mute);
          border-radius: 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 120ms;
        }
        .k2-icon-btn:hover {
          color: var(--k2-text);
          background: var(--k2-bg-hover);
        }

        /* ─── Topbar ─── */
        .k2-topbar {
          height: var(--k2-topbar-h);
          border-bottom: 1px solid var(--k2-border);
          display: flex;
          align-items: center;
          padding: 0 28px;
          gap: 16px;
          background: var(--k2-bg);
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(8px);
        }
        .k2-crumb {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--k2-text-dim);
          font-size: 13px;
        }
        .k2-crumb .divider { color: var(--k2-text-mute); }
        .k2-crumb .current {
          color: var(--k2-text);
          font-weight: 500;
        }

        .k2-cmd-trigger {
          flex: 1;
          max-width: 420px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 12px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text-mute);
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }
        .k2-cmd-trigger:hover {
          border-color: var(--k2-border-strong);
          color: var(--k2-text-dim);
        }
        .k2-cmd-trigger .kbd {
          margin-left: auto;
          display: flex;
          gap: 2px;
        }
        .k2-kbd-key {
          font-size: 10px;
          padding: 2px 5px;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          border-radius: 4px;
          color: var(--k2-text-dim);
          line-height: 1;
          font-weight: 500;
        }

        .k2-topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .k2-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: var(--k2-radius-sm);
          font-size: 13px;
          font-weight: 500;
          transition: all 120ms;
          border: 1px solid transparent;
          cursor: pointer;
        }
        .k2-btn-primary {
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
        }
        .k2-btn-primary:hover { filter: brightness(1.08); }
        .k2-btn-ghost {
          color: var(--k2-text-dim);
          border-color: var(--k2-border);
          background: var(--k2-bg-elev);
        }
        .k2-btn-ghost:hover {
          color: var(--k2-text);
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-hover);
        }
        .k2-notif-dot {
          position: relative;
        }
        .k2-notif-dot::after {
          content: '';
          position: absolute;
          top: 6px;
          right: 6px;
          width: 6px;
          height: 6px;
          background: var(--k2-bad);
          border-radius: 50%;
          border: 2px solid var(--k2-bg);
        }

        .k2-main {
          min-width: 0;           /* allow shrink in the grid */
          max-width: 100%;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;     /* trap any stray inner overflow */
        }

        /* ─── Mobile ─── */
        @media (max-width: 900px) {
          .k2-shell { grid-template-columns: 1fr; }
          .k2-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            width: var(--k2-sidebar-w);
            z-index: 40;
            transform: translateX(-100%);
            transition: transform 200ms ease;
          }
          .k2-sidebar.open { transform: translateX(0); }
          .k2-mobile-burger { display: inline-flex; }
          .k2-cmd-trigger { max-width: none; }
        }
        @media (min-width: 901px) {
          .k2-mobile-burger { display: none; }
        }

        /* ─── Scrollbar ─── */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: var(--k2-border-strong);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover { background: var(--k2-text-mute); }
      `}</style>

      <div className="k2-shell">
        <Sidebar
          pathname={pathname}
          user={session?.user}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="k2-main">
          <Topbar
            crumb={crumb}
            hasUnread={hasUnread}
            onBurger={() => setMobileOpen(true)}
          />
          {/* Page content — each page adds its own padding if needed. Dashboard
              cancels this with negative margin so the hero spans full bleed. */}
          <div style={{ padding: '1rem 1.5rem 1.5rem' }}>{children}</div>
        </div>
      </div>
    </ToastProvider>
  )
}

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────
function Sidebar({
  pathname,
  user,
  open,
  onClose,
}: {
  pathname: string
  user?: { firstName?: string; lastName?: string; email?: string; role?: string }
  open: boolean
  onClose: () => void
}) {
  const gabineteName = useGabineteName()
  const initials = useInitials(user)

  return (
    <aside className={cn('k2-sidebar', open && 'open')}>
      <div className="k2-sb-head">
        <div className="k2-brand">
          <div className="k2-brand-logo" aria-label="Kamaia">
            <Logo height={20} />
          </div>
          <div className="k2-brand-sub" title={gabineteName}>
            {gabineteName}
          </div>
        </div>
        <button className="k2-ws-btn" onClick={onClose} aria-label="Fechar menu">
          {open ? <X size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      <nav className="k2-nav-group">
        <div className="k2-nav-label">Trabalho</div>
        {WORK_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
        ))}
        <div className="k2-nav-label" style={{ marginTop: 8 }}>
          Ferramentas
        </div>
        {TOOLS_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
        ))}
      </nav>

      <div className="k2-sb-foot">
        <UserChip user={user} initials={initials} />
      </div>
    </aside>
  )
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem
  pathname: string
  onClick?: () => void
}) {
  const Icon = item.icon
  const active =
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

  const { data } = useApi<{ total?: number } | { data: unknown[]; total?: number }>(
    item.countEndpoint ?? null,
  )
  const count =
    data && typeof data === 'object' && 'total' in data && typeof data.total === 'number'
      ? data.total
      : null

  return (
    <Link
      href={item.href}
      className={cn('k2-nav-item', active && 'active')}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <Icon />
      <span>{item.label}</span>
      {count != null && count > 0 && <span className="k2-nav-count">{count}</span>}
    </Link>
  )
}

function UserChip({
  user,
  initials,
}: {
  user?: { firstName?: string; lastName?: string; email?: string; role?: string }
  initials: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Utilizador'
  const roleLabel = user?.role === 'SOCIO_GESTOR' ? 'Sócio Gestor'
    : user?.role === 'ADVOGADO_SOLO' ? 'Advogado Solo'
    : user?.role === 'ADVOGADO_MEMBRO' ? 'Advogado Membro'
    : user?.role === 'ESTAGIARIO' ? 'Estagiário'
    : ''

  return (
    <div className="k2-user-chip" ref={ref}>
      <div className="k2-avatar">{initials}</div>
      <div className="k2-user-meta">
        <div className="k2-user-name">{displayName}</div>
        <div className="k2-user-mail">{roleLabel || user?.email}</div>
      </div>
      <button
        className="k2-icon-btn"
        onClick={() => setOpen(!open)}
        aria-label="Menu do utilizador"
      >
        <Settings size={15} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'calc(100% + 8px)',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border-strong)',
            borderRadius: 'var(--k2-radius)',
            padding: 6,
            boxShadow: '0 10px 30px -12px rgba(0,0,0,0.6)',
            zIndex: 30,
          }}
          role="menu"
        >
          <Link
            href="/configuracoes"
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

// ─────────────────────────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────────────────────────
function Topbar({
  crumb,
  hasUnread,
  onBurger,
}: {
  crumb: { root: string; current: string }
  hasUnread: boolean
  onBurger: () => void
}) {
  const { theme, toggle: toggleTheme } = useTheme()

  return (
    <header className="k2-topbar">
      <button
        className="k2-icon-btn k2-mobile-burger"
        onClick={onBurger}
        aria-label="Abrir menu"
      >
        <Menu size={16} />
      </button>

      <div className="k2-crumb">
        <span>{crumb.root}</span>
        <span className="divider">/</span>
        <span className="current">{crumb.current}</span>
      </div>

      <div style={{ flex: 1, maxWidth: 420, margin: '0 auto' }}>
        <GlobalSearch />
      </div>

      <div className="k2-topbar-actions">
        <AIButton />
        <NotificationsPopover hasUnread={hasUnread} />
        <button
          className="k2-icon-btn"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <NewDropdownButton />
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function useGabineteName(): string {
  const { data } = useApi<{ name: string } | { data: { name: string } }>(
    '/gabinetes/current',
  )
  if (!data) return 'Gabinete'
  if ('data' in data && data.data) return data.data.name ?? 'Gabinete'
  if ('name' in data && data.name) return data.name
  return 'Gabinete'
}

function useInitials(user?: {
  firstName?: string
  lastName?: string
  email?: string
}): string {
  if (!user) return '—'
  const first = user.firstName?.[0]
  const last = user.lastName?.[0]
  if (first && last) return (first + last).toUpperCase()
  if (user.email) return user.email.slice(0, 2).toUpperCase()
  return '—'
}

/** Breadcrumb derived from the current pathname.
 *  '/' → { root: 'Início', current: 'Dashboard' }
 *  '/projectos/abc' → { root: 'Início', current: 'Projectos' }  */
function computeCrumb(pathname: string): { root: string; current: string } {
  const segMap: Record<string, string> = {
    '': 'Dashboard',
    projectos: 'Projectos',
    processos: 'Processos',
    clientes: 'Clientes',
    agenda: 'Agenda',
    prazos: 'Prazos',
    documentos: 'Documentos',
    timesheets: 'Timesheets',
    despesas: 'Despesas',
    facturas: 'Facturas',
    tarefas: 'Tarefas',
    'ia-assistente': 'IA Assistente',
    equipa: 'Equipa',
    configuracoes: 'Configurações',
  }
  const seg = pathname.split('/').filter(Boolean)[0] ?? ''
  return {
    root: 'Início',
    current: segMap[seg] ?? (seg ? (seg[0]?.toUpperCase() ?? '') + seg.slice(1) : 'Dashboard'),
  }
}
