'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Scale,
  Users,
  Calendar,
  Clock,
  FileText,
  Bot,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
        isActive
          ? 'bg-amber text-ink font-medium'
          : 'text-bone/80 hover:bg-ink/50 hover:text-bone',
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{item.label}</span>
    </Link>
  )
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="h-full bg-ink flex flex-col">
      <div className="p-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-amber">Kamaia</h1>
          <p className="text-bone/60 text-xs font-mono mt-1">Gestao Juridica</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-bone hover:text-amber transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-bone/40 text-xs font-mono font-medium mb-2 px-4">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} isActive={pathname === item.href} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-bone/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber/20 flex items-center justify-center">
            <span className="text-amber font-mono font-medium">
              {session?.user?.firstName?.[0]}
              {session?.user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-bone text-sm font-medium truncate">
              {session?.user?.firstName} {session?.user?.lastName}
            </p>
            <p className="text-bone/60 text-xs font-mono truncate">{session?.user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-bone/80 hover:text-error hover:bg-error/10 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="hidden lg:block w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/80" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-ink">
            <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-ink border-b border-bone/10 p-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-amber">Kamaia</h1>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-bone hover:text-amber transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-paper p-6">{children}</main>
      </div>
    </div>
  )
}
