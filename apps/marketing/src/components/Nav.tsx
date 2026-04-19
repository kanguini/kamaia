'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { appUrl } from '@/lib/utm'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/funcionalidades', label: 'Funcionalidades' },
  { href: '/precos', label: 'Preços' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contacto', label: 'Contacto' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200',
        scrolled
          ? 'border-b border-white/10 bg-[#0a0f1f]/85 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="shell flex h-[68px] items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center text-white hover:opacity-90"
          aria-label="Kamaia — Início"
        >
          <Logo height={22} />
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-white/75 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Link
            href={appUrl('/login', 'nav')}
            className="rounded-md px-3 py-1.5 text-sm text-white/75 transition-colors hover:text-white"
          >
            Entrar
          </Link>
          <Link
            href={appUrl('/register', 'nav')}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:scale-[1.02] hover:bg-white/95"
          >
            Começar grátis
          </Link>
        </div>

        {/* Mobile */}
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <span className="text-base leading-none text-white select-none">✕</span>
          ) : (
            <span className="flex flex-col gap-[5px] items-center justify-center w-4" aria-hidden="true">
              <span className="block h-px w-full bg-white/80" />
              <span className="block h-px w-full bg-white/80" />
              <span className="block h-px w-3 bg-white/80" />
            </span>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-black md:hidden">
          <div className="shell flex flex-col gap-4 py-6">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-lg text-white/85 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-white/5 pt-6">
              <Link
                href={appUrl('/login', 'nav')}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-white"
              >
                Entrar
              </Link>
              <Link
                href={appUrl('/register', 'nav')}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Começar grátis
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
