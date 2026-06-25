'use client'

/**
 * Layout partilhado por /biblioteca/* — fornece tab bar único entre
 * Templates, Cláusulas, Tipos de contrato.
 *
 * Sprint 3.2: consolida os 3 catálogos de organização sob a mesma
 * IA visual (mesma h1, mesmas tabs, mesmo padding). Cada sub-página
 * mantém o seu próprio conteúdo.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, ScrollText, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabDef {
  href: string
  label: string
  icon: React.ElementType
}

const TABS: TabDef[] = [
  { href: '/biblioteca/templates', label: 'Templates', icon: BookOpen },
  { href: '/biblioteca/clausulas', label: 'Cláusulas', icon: ScrollText },
  { href: '/biblioteca/tipos', label: 'Tipos de contrato', icon: Tag },
]

export default function BibliotecaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''

  // Em /biblioteca (index landing) não mostramos as tabs — só
  // queremos a hero strip nas sub-páginas.
  const isLanding = pathname === '/biblioteca'

  return (
    <div className="bib-shell">
      {!isLanding && (
        <header className="bib-shell-head">
          <Link href="/biblioteca" className="bib-shell-back">
            <span aria-hidden>‹</span> Biblioteca
          </Link>
          <nav className="bib-shell-tabs" role="tablist">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  role="tab"
                  aria-selected={active}
                  className={cn('bib-shell-tab', active && 'active')}
                >
                  <t.icon size={13} />
                  <span>{t.label}</span>
                </Link>
              )
            })}
          </nav>
        </header>
      )}
      <div className="bib-shell-body">{children}</div>

      <style jsx>{`
        .bib-shell {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .bib-shell-head {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .bib-shell-back {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--k2-text-mute);
          font-size: 11px;
          text-decoration: none;
          align-self: flex-start;
        }
        .bib-shell-back:hover {
          color: var(--k2-text-dim);
        }
        .bib-shell-tabs {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid var(--k2-border);
        }
        .bib-shell-tab {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          color: var(--k2-text-mute);
          font-size: 12px;
          font-weight: 500;
          text-decoration: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .bib-shell-tab:hover {
          color: var(--k2-text-dim);
        }
        .bib-shell-tab.active {
          color: var(--k2-text);
          border-bottom-color: var(--k2-text);
        }
        .bib-shell-body {
          min-height: 200px;
        }
      `}</style>
    </div>
  )
}
