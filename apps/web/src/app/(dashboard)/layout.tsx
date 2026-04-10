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
        'flex items-center gap-3 px-4 py-2.5 rounded-lg min-h-[44px] motion-safe:transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
        isActive
          ? 'bg-amber text-ink font-medium'
          : 'text-bone/80 hover:bg-ink/50 hover:text-bone',
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  )
}

function NotificationBell() {
  const { data: countData, refetch } = useApi<{ count: number }>('/notifications/unread-count')

  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 60000) // Refetch every 60s
    return () => clearInterval(interval)
  }, [refetch])

  const count = countData?.count || 0
  const label =
    count > 0
      ? `Notificacoes (${count} nao lida${count === 1 ? '' : 's'})`
      : 'Notificacoes'

  return (
    <Link
      href="/configuracoes"
      aria-label={label}
      className={cn(
        'relative text-bone hover:text-amber motion-safe:transition-colors p-2 rounded-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
      )}
    >
      <Bell className="w-5 h-5" aria-hidden="true" />
      {count > 0 && (
        <span
          className="absolute top-0 right-0 bg-error text-white text-xs font-mono font-medium rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
          aria-hidden="true"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside
      aria-label="Navegacao principal"
      className="h-full bg-ink flex flex-col"
    >
      <div className="p-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-amber">Kamaia</h1>
          <p className="text-bone/60 text-xs font-mono mt-1">Gestao Juridica</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className={cn(
              'lg:hidden text-bone hover:text-amber motion-safe:transition-colors p-1 rounded-lg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber',
            )}
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto" aria-label="Menu">
        {navSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-bone/40 text-xs font-mono font-medium mb-2 px-4">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {navSections.find((s) => s.title === section.title)?.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    isActive={pathname === item.href}
                    onClick={onClose}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-bone/10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full bg-amber/20 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <span className="text-amber font-mono font-medium">
              {session?.user?.firstName?.[0]}
              {session?.user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-bone text-sm font-medium truncate">
              {session?.user?.firstName} {session?.user?.lastName}
            </p>
            <p className="text-bone/60 text-xs font-mono truncate">
              {session?.user?.role}
            </p>
          </div>
          <NotificationBell />
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          aria-label="Sair da conta"
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 min-h-[44px]',
            'text-bone/80 hover:text-error hover:bg-error/10 rounded-lg text-sm',
            'motion-safe:transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
          )}
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}

function MobileSidebarOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const containerRef = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navegacao"
    >
      <div
        className="absolute inset-0 bg-ink/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div ref={containerRef} className="absolute inset-y-0 left-0 w-64 bg-ink">
        <Sidebar onClose={onClose} />
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden">
      <a href="#main-content" className="skip-link">
        Saltar para o conteudo principal
      </a>

      <div className="hidden lg:block w-64 flex-shrink-0">
        <Sidebar />
      </div>

      <MobileSidebarOverlay
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="lg:hidden bg-ink border-b border-bone/10 p-4 flex items-center justify-between"
          role="banner"
        >
          <h1 className="font-display text-2xl font-semibold text-amber">Kamaia</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu de navegacao"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-sidebar"
              className={cn(
                'text-bone hover:text-amber motion-safe:transition-colors p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
              )}
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-paper p-4 sm:p-6 focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
