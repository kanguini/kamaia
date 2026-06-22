'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTenants } from '@/hooks/use-tenants'
import { TenantPlan } from '@kamaia/shared-types'

const TABS: Array<{ href: string; label: string; agencyOnly?: boolean }> = [
  { href: '/configuracoes/organizacao', label: 'Organização' },
  { href: '/configuracoes/equipa', label: 'Equipa' },
  { href: '/configuracoes/sub-tenants', label: 'Sub-tenants', agencyOnly: true },
]

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { active } = useTenants()
  const isAgency = active?.plan === TenantPlan.AGENCY

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Configurações</h1>
      </header>

      <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--k2-border)' }}>
        {TABS.filter((t) => !t.agencyOnly || isAgency).map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/')
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: '10px 14px',
                borderBottom: active ? '2px solid var(--k2-accent)' : '2px solid transparent',
                color: active ? 'var(--k2-text)' : 'var(--k2-text-dim)',
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: active ? 500 : 400,
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
