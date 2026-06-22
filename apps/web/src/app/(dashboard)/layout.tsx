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
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  FileText,
  Building2,
  Briefcase,
  ShieldCheck,
  Upload,
  Bot,
  BookOpen,
  Bell,
  Settings,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Check,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { useTenants } from '@/hooks/use-tenants'
import { ToastProvider } from '@/components/ui/toast'
import { Logo } from '@/components/ui/logo'
import { TenantPlan } from '@kamaia/shared-types'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  match?: (pathname: string) => boolean
}

const WORK_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, match: (p) => p === '/' },
  { label: 'Contratos', href: '/contratos', icon: FileText },
  { label: 'Entidades', href: '/entidades', icon: Building2 },
  { label: 'Carteiras', href: '/carteiras', icon: Briefcase },
  { label: 'Alertas', href: '/alertas', icon: Bell },
  { label: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { label: 'Importação', href: '/importacao', icon: Upload },
]

const TOOLS_NAV: NavItem[] = [
  { label: 'IA', href: '/ia', icon: Bot },
  { label: 'Templates', href: '/biblioteca/templates', icon: BookOpen },
  { label: 'Cláusulas', href: '/biblioteca/clausulas', icon: BookOpen },
  { label: 'Configurações', href: '/configuracoes/organizacao', icon: Settings, match: (p) => p.startsWith('/configuracoes') },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="k2-shell">
        <Sidebar
          pathname={pathname}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="k2-main">
          <Topbar
            user={session?.user}
            onBurger={() => setMobileOpen(true)}
          />
          <div style={{ padding: '1.25rem 1.5rem 2rem' }}>{children}</div>
        </div>
      </div>
    </ToastProvider>
  )
}

function Sidebar({
  pathname,
  open,
  onClose,
}: {
  pathname: string
  open: boolean
  onClose: () => void
}) {
  return (
    <aside className={cn('k2-sidebar', open && 'open')}>
      <div className="k2-sb-head">
        <div className="k2-brand">
          <div className="k2-brand-logo" aria-label="Kamaia">
            <Logo height={20} />
          </div>
          <div className="k2-brand-sub">CLM</div>
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
  const active = item.match
    ? item.match(pathname)
    : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className={cn('k2-nav-item', active && 'active')}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <Icon />
      <span>{item.label}</span>
    </Link>
  )
}

function Topbar({
  user,
  onBurger,
}: {
  user?: { firstName?: string; lastName?: string; email?: string }
  onBurger: () => void
}) {
  const { theme, toggle: toggleTheme } = useTheme()
  const initials = useInitials(user)

  return (
    <header className="k2-topbar">
      <button
        className="k2-icon-btn k2-mobile-burger"
        onClick={onBurger}
        aria-label="Abrir menu"
      >
        <Menu size={16} />
      </button>

      <TenantSwitcher />

      <div style={{ flex: 1 }} />

      <div className="k2-topbar-actions">
        <button
          className="k2-icon-btn"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <UserMenu user={user} initials={initials} />
      </div>
    </header>
  )
}

function TenantSwitcher() {
  const { tenants, active, switchTenant, loading } = useTenants()
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
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
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
        <Building2 size={14} />
        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.tenantName ?? 'Selecciona organização'}
        </span>
        {active?.plan === TenantPlan.AGENCY && (
          <span style={{ fontSize: 10, color: 'var(--k2-accent)', letterSpacing: '0.06em' }}>AGENCY</span>
        )}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 260,
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border-strong)',
            borderRadius: 'var(--k2-radius)',
            padding: 4,
            boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)',
            zIndex: 50,
          }}
        >
          {tenants.map((t) => {
            const isActive = active?.tenantId === t.tenantId
            return (
              <button
                key={t.tenantId}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  if (!isActive) switchTenant(t.tenantId)
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
                    {t.tenantName}
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
}: {
  user?: { firstName?: string; lastName?: string; email?: string }
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
            right: 0,
            top: 'calc(100% + 6px)',
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
