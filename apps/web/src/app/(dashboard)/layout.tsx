'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Scale, Users, Calendar, Clock, FileText,
  Timer, Receipt, Bot, Settings, Menu, X, LogOut, Bell, Sun, Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useTheme } from '@/hooks/use-theme'

interface NavItem { label: string; href: string; icon: React.ElementType }

const navSections = [
  { title: 'PRINCIPAL', items: [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Processos', href: '/processos', icon: Scale },
    { label: 'Clientes', href: '/clientes', icon: Users },
  ]},
  { title: 'GESTAO', items: [
    { label: 'Agenda', href: '/agenda', icon: Calendar },
    { label: 'Prazos', href: '/prazos', icon: Clock },
    { label: 'Documentos', href: '/documentos', icon: FileText },
    { label: 'Timesheets', href: '/timesheets', icon: Timer },
    { label: 'Despesas', href: '/despesas', icon: Receipt },
  ]},
  { title: 'FERRAMENTAS', items: [
    { label: 'IA Assistente', href: '/ia-assistente', icon: Bot },
    { label: 'Configuracoes', href: '/configuracoes', icon: Settings },
  ]},
]

function NavLink({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-[14px] rounded-lg transition-all min-h-[40px]',
        isActive
          ? '[background:var(--color-sidebar-active-bg)] [color:var(--color-sidebar-active-text)] font-medium'
          : '[color:var(--color-sidebar-text-muted)] hover:[background:var(--color-sidebar-hover-bg)] hover:[color:var(--color-sidebar-text)]',
      )}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" style={{ opacity: isActive ? 1 : 0.6 }} />
      <span>{item.label}</span>
    </Link>
  )
}

function NotificationBell() {
  const { data: countData, refetch } = useApi<{ count: number }>('/notifications/unread-count')
  useEffect(() => { const i = setInterval(() => refetch(), 60000); return () => clearInterval(i) }, [refetch])
  const count = countData?.count || 0
  return (
    <Link href="/configuracoes" aria-label={count > 0 ? `Notificacoes (${count})` : 'Notificacoes'} className="relative text-ink-muted hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-surface-hover">
      <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
      {count > 0 && <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[9px] font-mono font-medium min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </Link>
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

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside aria-label="Navegacao principal" className="h-full [background:var(--color-sidebar-bg)] flex flex-col border-r [border-color:var(--color-sidebar-border)]" style={{ borderRightWidth: '1px' }}>
      <div className="px-5 pt-7 pb-5 border-b [border-color:var(--color-sidebar-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold [color:var(--color-ink)] tracking-[-0.02em]">Kamaia</h1>
            <p className="text-[11px] [color:var(--color-sidebar-text-ghost)] mt-0.5">Gestao Juridica</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fechar menu" className="lg:hidden [color:var(--color-sidebar-text-muted)] hover:[color:var(--color-sidebar-text)] p-1 rounded-lg">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto" aria-label="Menu">
        {navSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-[10px] font-semibold tracking-[0.12em] uppercase [color:var(--color-sidebar-text-ghost)] px-3 mb-2">{section.title}</h2>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}><NavLink item={item} isActive={pathname === item.href} onClick={onClose} /></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t [border-color:var(--color-sidebar-border)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 [background:var(--color-sidebar-hover-bg)] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="[color:var(--color-sidebar-text-muted)] font-mono text-[11px] font-medium">{session?.user?.firstName?.[0]}{session?.user?.lastName?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="[color:var(--color-sidebar-text)] text-[13px] font-medium truncate">{session?.user?.firstName} {session?.user?.lastName}</p>
            <p className="[color:var(--color-sidebar-text-ghost)] text-[10px] font-mono truncate">{session?.user?.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sair da conta"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 [color:var(--color-sidebar-text-muted)] hover:text-danger hover:bg-danger-bg text-[12px] transition-colors min-h-[36px] rounded-lg"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sair</span>
        </button>
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
  const { data: session } = useSession()

  return (
    <div className="h-screen flex overflow-hidden bg-surface">
      <a href="#main-content" className="skip-link">Saltar para o conteudo principal</a>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[260px] flex-shrink-0">
        <Sidebar />
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
            <h1 className="lg:hidden text-[16px] font-semibold text-ink">Kamaia</h1>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 bg-surface-raised rounded-xl px-2 py-1.5 border border-border" style={{ borderWidth: '1px' }}>
            <div className="hidden sm:flex items-center gap-2 px-2">
              <div className="w-7 h-7 bg-surface-hover rounded-lg flex items-center justify-center">
                <span className="text-ink-muted font-mono text-[10px] font-medium">{session?.user?.firstName?.[0]}{session?.user?.lastName?.[0]}</span>
              </div>
              <span className="text-[12px] text-ink-secondary font-medium">{session?.user?.firstName}</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-border mx-1" />
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
  )
}
