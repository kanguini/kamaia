'use client'

/**
 * /biblioteca — landing da Biblioteca consolidada.
 *
 * Sprint 3.1: ponto único de entrada para os catálogos da
 * organização. Sprint 3.2 expandirá isto num layout com 4 sub-tabs
 * (Templates | Cláusulas | Tipos de contrato | Custom fields).
 *
 * Por agora, mostra os 3 catálogos como cards que linkam para as
 * sub-páginas existentes. Mantém /biblioteca/templates e /clausulas
 * acessíveis directamente.
 */

import Link from 'next/link'
import { BookOpen, ScrollText, Tag, Sparkles } from 'lucide-react'

interface CatalogoCard {
  href: string
  icon: React.ElementType
  title: string
  hint: string
  status?: 'novo' | 'beta'
}

const CARDS: CatalogoCard[] = [
  {
    href: '/biblioteca/templates',
    icon: BookOpen,
    title: 'Templates',
    hint: 'Modelos de contrato reutilizáveis com placeholders dinâmicos. Gerar nova versão a partir de template em 1 clique.',
  },
  {
    href: '/biblioteca/clausulas',
    icon: ScrollText,
    title: 'Cláusulas',
    hint: 'Biblioteca de cláusulas pré-aprovadas (foro, lei aplicável, confidencialidade, força maior). Inserir no editor com 1 clique.',
  },
  {
    href: '/biblioteca/tipos',
    icon: Tag,
    title: 'Tipos de contrato',
    hint: 'Catálogo de tipos (NDA, Arrendamento, Agência, Vendor, etc.) com gatilhos regulatórios padrão e custom fields per-tipo.',
  },
  {
    href: '/biblioteca/tipos',
    icon: Sparkles,
    title: 'Custom fields',
    hint: 'Campos extra definidos por tipo de contrato. Editáveis via cada tipo.',
    status: 'novo',
  },
]

export default function BibliotecaLandingPage() {
  return (
    <div className="bib">
      <header className="bib-head">
        <h1 className="bib-h1">Biblioteca</h1>
        <p className="bib-sub">
          Tudo o que a tua organização reutiliza: templates, cláusulas,
          tipos de contrato e custom fields.
        </p>
      </header>

      <div className="bib-grid">
        {CARDS.map((c) => (
          <Link key={c.title} href={c.href} className="bib-card">
            <c.icon size={18} className="bib-card-icon" />
            <div className="bib-card-text">
              <div className="bib-card-title">
                {c.title}
                {c.status === 'novo' && <span className="bib-pill">novo</span>}
              </div>
              <div className="bib-card-hint">{c.hint}</div>
            </div>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .bib {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .bib-head {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .bib-h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--k2-text);
        }
        .bib-sub {
          margin: 0;
          font-size: 13px;
          color: var(--k2-text-mute);
          max-width: 560px;
          line-height: 1.5;
        }
        .bib-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }
        .bib-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          color: var(--k2-text);
          text-decoration: none;
          transition: border-color 120ms ease, background 120ms ease;
        }
        .bib-card:hover {
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-hover);
        }
        .bib-card-icon {
          color: var(--k2-text-mute);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .bib-card-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .bib-card-title {
          font-size: 14px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .bib-card-hint {
          font-size: 12px;
          color: var(--k2-text-mute);
          line-height: 1.5;
        }
        .bib-pill {
          display: inline-grid;
          place-items: center;
          padding: 1px 6px;
          background: var(--k2-bg-elev-2);
          border-radius: 999px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--k2-text-dim);
          text-transform: uppercase;
        }
      `}</style>
    </div>
  )
}
