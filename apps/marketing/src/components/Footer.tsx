import Link from 'next/link'
import { Logo } from './Logo'

const LINKS = {
  Produto: [
    { href: '/funcionalidades', label: 'Funcionalidades' },
    { href: '/precos', label: 'Preços' },
    { href: 'https://app.kamaia.cc', label: 'Aceder à aplicação', external: true },
  ],
  Empresa: [
    { href: '/sobre', label: 'Sobre' },
    { href: '/contacto', label: 'Contacto' },
  ],
  Legal: [
    { href: '/politica-privacidade', label: 'Privacidade' },
    { href: '/termos', label: 'Termos de serviço' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black">
      <div className="shell grid gap-10 py-16 md:grid-cols-[1.2fr_repeat(3,_1fr)]">
        <div>
          <Logo height={22} className="text-white" />
          <p className="mt-4 max-w-xs text-sm text-white/60">
            Gestão jurídica inteligente para advogados, escritórios e gabinetes
            jurídicos.
          </p>
        </div>
        {Object.entries(LINKS).map(([group, links]) => (
          <div key={group}>
            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
              {group}
            </h3>
            <ul className="space-y-3">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    target={'external' in l && l.external ? '_blank' : undefined}
                    rel={'external' in l && l.external ? 'noopener' : undefined}
                    className="text-sm text-white/75 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="shell flex flex-col items-start justify-between gap-4 py-6 text-xs text-white/40 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Kamaia. Todos os direitos reservados.</p>
          <p>
            <Link href="mailto:hello@kamaia.cc" className="hover:text-white/70">
              hello@kamaia.cc
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
