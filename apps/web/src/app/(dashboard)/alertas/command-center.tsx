'use client'

/**
 * CommandCenter — a fila de acção priorizada da carteira inteira.
 *
 * Lidera a página Calendário. Funde actos pendentes + contratos a
 * expirar numa lista única, agrupada por janela temporal (Em atraso
 * / Hoje / Esta semana / Este mês). Actos regulatórios resolvem-se
 * in-line; contratos linkam ao detalhe.
 *
 * É a vista matinal: "a tua carteira precisa de ti nestas N coisas,
 * por ordem de urgência". O Contracko só oferece isto como prompt
 * de chat; aqui é a fila real, accionável.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  computarPortfolio,
  BUCKET_LABELS,
  type Bucket,
  type PortfolioActo,
  type PortfolioContrato,
  type PortfolioItem,
} from './portfolio-engine'

const BUCKET_ORDER: Bucket[] = ['atrasado', 'hoje', 'semana', 'mes']

export function CommandCenter({
  actos,
  contratos,
  onResolved,
}: {
  actos: PortfolioActo[]
  contratos: PortfolioContrato[]
  onResolved: () => void
}) {
  const { data: session } = useSession()
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const resultado = useMemo(
    () => computarPortfolio({ actos, contratos }),
    [actos, contratos],
  )

  const totalVisivel = resultado.total - resolvidos.size

  if (totalVisivel <= 0) {
    return (
      <div className="cc-clear">
        <CheckCircle2 size={18} className="cc-clear-icon" />
        <div>
          <div className="cc-clear-title">A carteira está em dia</div>
          <div className="cc-clear-sub">
            Sem actos pendentes, prazos iminentes ou renovações por decidir
            nos próximos 30 dias.
          </div>
        </div>
        <style jsx>{clearCss}</style>
      </div>
    )
  }

  const concluirActo = async (item: PortfolioItem) => {
    if (!item.actoId || !session?.accessToken) return
    setBusy(item.id)
    try {
      await api(`/compliance/actos/${item.actoId}/concluir`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({}),
      })
      setResolvidos((s) => new Set(s).add(item.id))
      onResolved()
    } catch {
      /* mantém na lista */
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="cc">
      <header className="cc-head">
        <AlertTriangle size={14} className="cc-head-icon" />
        <span className="cc-head-title">A tua carteira precisa de ti</span>
        <span className="cc-head-count">{totalVisivel}</span>
      </header>

      <div className="cc-buckets">
        {BUCKET_ORDER.map((bucket) => {
          const items = resultado.buckets[bucket].filter(
            (i) => !resolvidos.has(i.id),
          )
          if (items.length === 0) return null
          return (
            <div key={bucket} className={`cc-bucket bk-${bucket}`}>
              <div className="cc-bucket-label">
                {BUCKET_LABELS[bucket]}
                <span className="cc-bucket-n">{items.length}</span>
              </div>
              <div className="cc-items">
                {items.map((item) => (
                  <div key={item.id} className={`cc-item sev-${item.severidade}`}>
                    {item.categoria === 'compliance' ? (
                      <ShieldAlert size={14} className="cc-item-icon" />
                    ) : (
                      <AlertTriangle size={14} className="cc-item-icon" />
                    )}
                    <div className="cc-item-body">
                      <div className="cc-item-titulo">{item.titulo}</div>
                      <div className="cc-item-detalhe">{item.detalhe}</div>
                      <Link href={`/contratos/${item.contratoId}`} className="cc-item-contrato">
                        {item.contratoNumero} · {item.contratoTitulo}
                        <ChevronRight size={10} />
                      </Link>
                    </div>
                    {item.actoId && (
                      <button
                        type="button"
                        className="cc-item-resolver"
                        disabled={busy === item.id}
                        onClick={() => void concluirActo(item)}
                        title="Marcar acto como concluído"
                      >
                        {busy === item.id ? '…' : 'Concluir'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{mainCss}</style>
    </section>
  )
}

const clearCss = `
  .cc-clear {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border);
    border-radius: var(--k2-radius);
  }
  .cc-clear-icon { color: var(--k2-good); flex-shrink: 0; }
  .cc-clear-title { font-size: 14px; font-weight: 600; color: var(--k2-text); }
  .cc-clear-sub { font-size: 12px; color: var(--k2-text-mute); margin-top: 2px; max-width: 520px; line-height: 1.5; }
`

const mainCss = `
  .cc {
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border-strong);
    border-radius: var(--k2-radius);
    overflow: hidden;
  }
  .cc-head {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--k2-border);
    background: var(--k2-bg-elev-2);
  }
  .cc-head-icon { color: var(--k2-warn); }
  .cc-head-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--k2-text);
  }
  .cc-head-count {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 7px;
    background: var(--k2-warn);
    color: #fff;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .cc-buckets { display: flex; flex-direction: column; }
  .cc-bucket { border-bottom: 1px solid var(--k2-border); }
  .cc-bucket:last-child { border-bottom: none; }
  .cc-bucket-label {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--k2-text-mute);
    background: var(--k2-bg);
  }
  .bk-atrasado .cc-bucket-label { color: var(--k2-bad); }
  .bk-hoje .cc-bucket-label { color: var(--k2-warn); }
  .cc-bucket-n {
    font-size: 10px;
    color: var(--k2-text-mute);
    background: var(--k2-bg-elev-2);
    border-radius: 999px;
    padding: 0 6px;
  }
  .cc-items { display: flex; flex-direction: column; }
  .cc-item {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding: 12px 16px;
    border-top: 1px solid var(--k2-border);
  }
  .cc-item:first-child { border-top: none; }
  .cc-item.sev-critico .cc-item-icon { color: var(--k2-bad); }
  .cc-item.sev-aviso .cc-item-icon { color: var(--k2-warn); }
  .cc-item-icon { flex-shrink: 0; margin-top: 1px; }
  .cc-item-body { flex: 1; min-width: 0; }
  .cc-item-titulo { font-size: 13px; font-weight: 600; color: var(--k2-text); }
  .cc-item-detalhe { font-size: 11.5px; color: var(--k2-text-mute); margin-top: 2px; line-height: 1.4; }
  .cc-item-contrato {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--k2-text-dim);
    text-decoration: none;
    margin-top: 5px;
  }
  .cc-item-contrato:hover { color: var(--k2-text); }
  .cc-item-resolver {
    flex-shrink: 0;
    font-size: 11.5px;
    font-weight: 500;
    font-family: inherit;
    padding: 5px 11px;
    border-radius: var(--k2-radius-sm);
    cursor: pointer;
    background: var(--k2-accent);
    color: var(--k2-accent-fg);
    border: 1px solid var(--k2-accent);
    transition: opacity 120ms ease;
  }
  .cc-item-resolver:hover:not(:disabled) { opacity: 0.9; }
  .cc-item-resolver:disabled { opacity: 0.5; cursor: default; }
`
