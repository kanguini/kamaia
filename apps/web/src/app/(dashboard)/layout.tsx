'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Scale,
  Users,
  Calendar,
  Clock,
  FileText,
  Timer,
  Receipt,
  Bot,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { useFocusTrap } from '@/hooks/use-focus-trap'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navSections = [
  {
    title: 'PRINCIPAL',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Processos', href: '/processos', icon: Scale },
      { label: 'Clientes', href: '/clientes', icon: Users },
    ],
  },
  {
    title: 'GESTAO',
    items: [
      { label: 'Agenda', href: '/agenda', icon: Calendar },
      { label: 'Prazos', href: '/prazos', icon: Clock },
      { label: 'Documentos', href: '/documentos', icon: FileText },
      { label: 'Timesheets', href: '/timesheets', icon: Timer },
      { label: 'Despesas', href: '/despesas', icon: Receipt },
    ],
  },
  {
    title: 'FERRAMENTAS',
    items: [
      { label: 'IA Assistente', href: '/ia-assistente', icon: Bot },
      { label: 'Configuracoes', href: '/configuracoes', icon: Settings },
    ],
  },
]

function NavLink({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-[14px] transition-all min-h-[40px]',
        isActive
          ? 'bg-white/10 text-white font-medium'
          : 'text-white/45 hover:bg-white/5 hover:text-white/80',
      )}
      style={{ borderRadius: '8px' }}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" style={{ opacity: isActive ? 1 : 0.5 }} />
      <span>{item.label}</span>
    </Link>
  )
}

function NotificationBell() {
  const { data: countData, refetch } = useApi<{ count: number }>('/notifications/unread-count')
  useEffect(() => {
    const interval = setInterval(() => refetch(), 60000)
    return () => clearInterval(interval)
  }, [refetch])
  const count = countData?.count || 0

  return (
    <Link
      href="/configuracoes"
      aria-label={count > 0 ? `Notificacoes (${count})` : 'Notificacoes'}
      className="relative text-white/40 hover:text-white transition-colors p-1"
    >
      <Bell className="w-4 h-4" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-[#F87171] text-white text-[9px] font-mono font-medium min-w-[14px] h-[14px] px-0.5 flex items-center justify-center" style={{ borderRadius: '4px' }} aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}

function Sidebar({ onClose, floating = false }: { onClose?: () => void; floating?: boolean }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside
      aria-label="Navegacao principal"
      className={cn(
        'h-full flex flex-col',
        floating
          ? 'bg-[#161616] m-3 shadow-xl overflow-hidden'
          : 'bg-[#161616]',
      )}
      style={floating ? { borderRadius: '16px', height: 'calc(100% - 24px)' } : {}}
    >
      {/* Logo */}
      <div className="px-5 pt-7 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[22px] text-white tracking-[-0.01em]">Kamaia</h1>
            <p className="text-[11px] text-white/25 mt-0.5 font-mono">Gestao Juridica</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fechar menu" className="lg:hidden text-white/40 hover:text-white p-1" style={{ borderRadius: '6px' }}>
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto" aria-label="Menu">
        {navSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/20 px-3 mb-2">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} isActive={pathname === item.href} onClick={onClose} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 bg-white/[0.08] flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: '10px' }}
          >
            <span className="text-white/60 font-mono text-[11px] font-medium">
              {session?.user?.firstName?.[0]}{session?.user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-[13px] font-medium truncate">
              {session?.user?.firstName} {session?.user?.lastName}
            </p>
            <p className="text-white/25 text-[10px] font-mono truncate">{session?.user?.role}</p>
          </div>
          <NotificationBell />
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sair da conta"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-white/30 hover:text-[#F87171] hover:bg-[#F87171]/10 text-[12px] transition-colors min-h-[36px]"
          style={{ borderRadius: '8px' }}
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
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegacao">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={containerRef} className="absolute inset-y-0 left-0 w-[240px] p-3">
        <Sidebar onClose={onClose} floating />
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden bg-[#0A0A0A]">
      <a href="#main-content" className="skip-link">Saltar para o conteudo principal</a>

      {/* Desktop floating sidebar */}
      <div className="hidden lg:block w-[256px] flex-shrink-0 p-3">
        <div className="h-full bg-[#161616] shadow-xl overflow-hidden" style={{ borderRadius: '16px' }}>
          <Sidebar floating={false} />
        </div>
      </div>

      <MobileSidebarOverlay open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-[#0A0A0A] border-b border-white/[0.06] px-4 flex items-center justify-between h-14" role="banner">
          <h1 className="font-display text-lg text-white">Kamaia</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={isMobileMenuOpen}
              className="text-white/40 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Main content area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-3 lg:pl-0 lg:py-3 lg:pr-3 focus:outline-none"
        >
          <div
            className="min-h-full bg-[#111111] p-6 sm:p-8"
            style={{ borderRadius: '16px' }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
