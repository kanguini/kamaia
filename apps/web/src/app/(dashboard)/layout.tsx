'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Scale, Users, Calendar, Clock, FileText,
  Timer, Receipt, Bot, Settings, Menu, X, LogOut, Bell, Sun, Moon, CheckSquare,
  PanelLeftClose, PanelLeftOpen, User, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useTheme } from '@/hooks/use-theme'
import { useSidebarState } from '@/hooks/use-sidebar-state'
import { ToastProvider } from '@/components/ui/toast'
import { Logo, LogoIcon } from '@/components/ui/logo'
import { NewDropdownButton } from '@/components/ui/new-dropdown'
import { GlobalSearch } from '@/components/ui/global-search'
import { AIButton } from '@/components/ui/ai-button'

interface NavItem { label: string; href: string; icon: React.ElementType }

const navSections = [
  { title: 'PRINCIPAL', items: [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Projectos', href: '/projectos', icon: Briefcase },
    { label: 'Processos', href: '/processos', icon: Scale },
    { label: 'Clientes', href: '/clientes', icon: Users },
  ]},
  { title: 'GESTÃO', items: [
    { label: 'Agenda', href: '/agenda', icon: Calendar },
    { label: 'Prazos', href: '/prazos', icon: Clock },
    { label: 'Documentos', href: '/documentos', icon: FileText },
    { label: 'Timesheets', href: '/timesheets', icon: Timer },
    { label: 'Despesas', href: '/despesas', icon: Receipt },
  ]},
  { title: 'FERRAMENTAS', items: [
    { label: 'Tarefas', href: '/tarefas', icon: CheckSquare },
    { label: 'IA Assistente', href: '/ia-assistente', icon: Bot },
    { label: 'Equipa', href: '/equipa', icon: Users },
  ]},
]

function NavLink({ item, isActive, onClick, collapsed }: { item: NavItem; isActive: boolean; onClick?: () => void; collapsed?: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 text-[14px] rounded-lg transition-all min-h-[40px]',
        collapsed ? 'justify-center px-2' : 'px-3 py-2.5',
        isActive
          ? '[background:var(--color-sidebar-active-bg)] [color:var(--color-sidebar-active-text)] font-medium'
          : '[color:var(--color-sidebar-text-muted)] hover:[background:var(--color-sidebar-hover-bg)] hover:[color:var(--color-sidebar-text)]',
      )}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" style={{ opacity: isActive ? 1 : 0.85 }} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: countData, refetch } = useApi<{ count: number }>('/notifications/unread-count')
  const { data: notifs, refetch: refetchNotifs } = useApi<{ data: Notification[] }>(
    open ? '/notifications?limit=10' : null,
    [open],
  )
  useEffect(() => { const i = setInterval(() => refetch(), 60000); return () => clearInterval(i) }, [refetch])
  const count = countData?.count || 0
  const items = notifs?.data || []

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) refetchNotifs() }}
        aria-label={count > 0 ? `Notificações (${count})` : 'Notificações'}
        aria-expanded={open}
        className="relative text-ink-muted hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-surface-hover"
      >
        <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 bg-danger text-surface text-[9px] font-mono font-medium min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-2 w-[360px] bg-surface-raised border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Notificações</h3>
              {count > 0 && <span className="text-[10px] font-mono text-ink-muted">{count} não lidas</span>}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-ink-muted">
                  Sem notificações
                </div>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={cn('px-4 py-3 border-b border-border last:border-0 hover:bg-surface-hover transition-colors', !n.isRead && 'bg-ink/5')}>
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="w-1.5 h-1.5 bg-danger rounded-full mt-2 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                        <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-ink-muted mt-1 font-mono">{new Date(n.createdAt).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-border text-center">
              <Link href="/configuracoes" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink">
                Definições de notificações
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
    >
      {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  )
}

function UserMenu({ collapsed, position = 'up' }: { collapsed?: boolean; position?: 'up' | 'down' }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const user = session?.user
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`
  const isTopbar = position === 'down'

  return (
    <div className={cn('relative', isTopbar ? '' : 'flex-1 min-w-0')} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Menu do utilizador"
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed || isTopbar ? `${user?.firstName} ${user?.lastName}` : undefined}
        className={cn(
          'flex items-center gap-2 rounded-lg transition-colors',
          isTopbar ? 'p-1.5 border border-border hover:bg-surface-raised' : 'w-full hover:[background:var(--color-sidebar-hover-bg)]',
          collapsed && !isTopbar ? 'justify-center p-1.5' : '',
          !collapsed && !isTopbar ? 'p-1.5' : '',
        )}
      >
        <div className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
          isTopbar ? 'bg-surface-raised' : '[background:var(--color-sidebar-hover-bg)]',
        )}>
          <span className={cn(
            'font-mono text-[11px] font-medium',
            isTopbar ? 'text-ink-muted' : '[color:var(--color-sidebar-text-muted)]',
          )}>{initials}</span>
        </div>
        {!collapsed && !isTopbar && (
          <div className="flex-1 min-w-0 text-left">
            <p className="[color:var(--color-sidebar-text)] text-[13px] font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="[color:var(--color-sidebar-text-ghost)] text-[10px] truncate">{user?.email}</p>
          </div>
        )}
        {isTopbar && (
          <span className="hidden sm:inline pr-2 text-[12px] text-ink-secondary font-medium">{user?.firstName}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute bg-surface-raised border border-border rounded-lg shadow-xl z-50 overflow-hidden py-1',
            isTopbar ? 'top-full mt-2 right-0 w-[240px]' : 'bottom-full mb-2',
            !isTopbar && collapsed ? 'left-0 w-[220px]' : '',
            !isTopbar && !collapsed ? 'left-0 right-0' : '',
          )}
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[13px] font-medium text-ink truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[11px] text-ink-muted truncate">{user?.email}</p>
            <p className="text-[10px] font-mono text-ink-muted/60 mt-0.5">{user?.role}</p>
          </div>
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors"
          >
            <User className="w-4 h-4 text-ink-muted" />
            Meu perfil
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              signOut({ callbackUrl: '/login' })
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar({ onClose, collapsed, onToggleCollapse }: { onClose?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const pathname = usePathname()

  return (
    <aside aria-label="Navegação principal" className="h-full [background:var(--color-sidebar-bg)] flex flex-col border-r [border-color:var(--color-sidebar-border)]" style={{ borderRightWidth: '1px' }}>
      <div className={cn('border-b [border-color:var(--color-sidebar-border)]', collapsed ? 'px-2 pt-5 pb-4' : 'px-5 pt-7 pb-5')}>
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-3' : 'justify-between')}>
          <div className={cn(collapsed && 'w-full flex justify-center')}>
            <h1 className="sr-only">Kamaia</h1>
            <div aria-hidden="true" className="[color:var(--color-ink)]">
              {collapsed ? <LogoIcon size={24} /> : <Logo height={28} />}
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fechar menu" className="lg:hidden [color:var(--color-sidebar-text-muted)] hover:[color:var(--color-sidebar-text)] p-1 rounded-lg">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <nav className={cn('flex-1 py-4 overflow-y-auto', collapsed ? 'px-2' : 'px-3')} aria-label="Menu">
        <ul className="space-y-1">
          {navSections.flatMap((section) =>
            section.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} isActive={pathname === item.href} onClick={onClose} collapsed={collapsed} />
              </li>
            )),
          )}
        </ul>
      </nav>

      {/* Footer: user menu + settings + collapse */}
      <div className={cn('border-t [border-color:var(--color-sidebar-border)]', collapsed ? 'p-2 space-y-1' : 'p-3')}>
        {collapsed ? (
          <>
            <UserMenu collapsed />
            <Link
              href="/configuracoes"
              aria-label="Configurações"
              title="Configurações"
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-colors',
                pathname === '/configuracoes'
                  ? '[background:var(--color-sidebar-active-bg)] [color:var(--color-sidebar-active-text)]'
                  : '[color:var(--color-sidebar-text-muted)] hover:[color:var(--color-sidebar-text)] hover:[background:var(--color-sidebar-hover-bg)]',
              )}
            >
              <Settings className="w-4 h-4" />
            </Link>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expandir menu"
                title="Expandir menu"
                className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg [color:var(--color-sidebar-text-muted)] hover:[color:var(--color-sidebar-text)] hover:[background:var(--color-sidebar-hover-bg)] transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1">
            <UserMenu />
            <Link
              href="/configuracoes"
              aria-label="Configurações"
              title="Configurações"
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-colors flex-shrink-0',
                pathname === '/configuracoes'
                  ? '[background:var(--color-sidebar-active-bg)] [color:var(--color-sidebar-active-text)]'
                  : '[color:var(--color-sidebar-text-muted)] hover:[color:var(--color-sidebar-text)] hover:[background:var(--color-sidebar-hover-bg)]',
              )}
            >
              <Settings className="w-4 h-4" />
            </Link>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Recolher menu"
                title="Recolher menu"
                className="hidden lg:flex items-center justify-center p-2 rounded-lg [color:var(--color-sidebar-text-muted)] hover:[color:var(--color-sidebar-text)] hover:[background:var(--color-sidebar-hover-bg)] transition-colors flex-shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function MobileSidebarOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containerRef = useFocusTrap<HTMLDivElement>(open)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={containerRef} className="absolute inset-y-0 left-0 w-[260px] shadow-xl">
        <Sidebar onClose={onClose} />
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isCollapsed, toggle: toggleCollapsed } = useSidebarState()

  return (
    <ToastProvider>
    <div className="h-screen flex overflow-hidden bg-surface">
      <a href="#main-content" className="skip-link">Saltar para o conteudo principal</a>

      {/* Desktop sidebar */}
      <div className={cn('hidden lg:block flex-shrink-0 transition-[width] duration-200', isCollapsed ? 'w-[72px]' : 'w-[260px]')}>
        <Sidebar collapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />
      </div>

      <MobileSidebarOverlay open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Floating topbar */}
        <header className="flex items-center justify-between px-6 py-3" role="banner">
          {/* Left: mobile menu + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={isMobileMenuOpen}
              className="lg:hidden p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div aria-hidden="true" className="lg:hidden text-ink">
              <Logo height={20} />
            </div>
            <span className="sr-only lg:hidden">Kamaia</span>
          </div>

          {/* Center: Global search */}
          <div className="flex-1 flex justify-center px-4 max-w-[600px]">
            <GlobalSearch />
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <AIButton />
            <NewDropdownButton />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto px-6 pb-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
  )
}
