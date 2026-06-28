'use client'

/**
 * RelacaoParceiro — transforma o contrato de ilha em nó de um grafo
 * de relações comerciais.
 *
 * Onde o Contracko mostra "Counterparty: Inov Holding" e pára, o
 * Kamaia mostra "Inov Holding · 3 contratos · 30M AOA total · maior
 * exposição da carteira Hexa". O contrato deixa de ser isolado.
 *
 * Para todas as partes do contrato, chama UMA vez o endpoint agregado
 * /entidades/contratos-resumo (SUM em SQL): quantos contratos
 * partilhamos, valor total e estados activos por entidade. Isto dá
 * contexto de RISCO e RELAÇÃO que nenhum CLM genérico oferece.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Building2, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'

interface ParteRef {
  id: string
  papel: string
  entidade: { id: string; nome: string }
}

/** Resposta do endpoint agregado /entidades/contratos-resumo. */
interface ResumoCarteira {
  entidadeId: string
  totalContratos: number
  valorTotalCentavos: string
  estadosActivos: number
}

interface AggParceiro {
  entidadeId: string
  nome: string
  papel: string
  totalContratos: number
  valorTotalAKZ: number
  estadosActivos: number
}

/** Centavos (inteiro) de um valor; somar em centavos e dividir uma só
 *  vez evita acumular erro de float ao agregar a exposição total. */
function centavosDe(valor: string | null): number {
  if (!valor) return 0
  const n = Number(valor)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export function RelacaoParceiro({
  contratoId,
  partes,
}: {
  contratoId: string
  partes: ParteRef[]
}) {
  const { data: session } = useSession()
  const [aggs, setAggs] = useState<AggParceiro[] | null>(null)

  useEffect(() => {
    if (!session?.accessToken || partes.length === 0) {
      setAggs([])
      return
    }
    let cancelled = false
    const token = session.accessToken
    const entidadeIds = partes.map((p) => p.entidade.id)

    const zeros = (): AggParceiro[] =>
      partes.map((p) => ({
        entidadeId: p.entidade.id,
        nome: p.entidade.nome,
        papel: p.papel,
        totalContratos: 0,
        valorTotalAKZ: 0,
        estadosActivos: 0,
      }))

    // PERF (H1): UMA query agregada (SUM em SQL no backend) em vez de
    // um pedido por parte com agregação no cliente.
    api<ResumoCarteira[]>('/entidades/contratos-resumo', {
      method: 'POST',
      token,
      body: JSON.stringify({ entidadeIds }),
    })
      .then((rows) => {
        if (cancelled) return
        const byId = new Map(
          (Array.isArray(rows) ? rows : []).map((r) => [r.entidadeId, r]),
        )
        setAggs(
          partes.map((p) => {
            const r = byId.get(p.entidade.id)
            return {
              entidadeId: p.entidade.id,
              nome: p.entidade.nome,
              papel: p.papel,
              totalContratos: r?.totalContratos ?? 0,
              valorTotalAKZ: r ? centavosDe(r.valorTotalCentavos) / 100 : 0,
              estadosActivos: r?.estadosActivos ?? 0,
            } as AggParceiro
          }),
        )
      })
      .catch(() => {
        if (!cancelled) setAggs(zeros())
      })

    return () => {
      cancelled = true
    }
    // Depende de uma chave derivada (ids das partes) e não da referência
    // do array — `partes` é recriado a cada refetch, o que provocava N
    // pedidos redundantes a cada resolução de acto/termo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, partes.map((p) => p.entidade.id).join(','), session?.accessToken])

  if (aggs === null) {
    return (
      <section className="rp">
        <div className="rp-title">Partes & relações</div>
        <div className="rp-skel" />
        <style jsx>{css}</style>
      </section>
    )
  }

  if (aggs.length === 0) {
    return (
      <section className="rp">
        <div className="rp-title">Partes & relações</div>
        <div className="rp-empty">Sem partes registadas neste contrato.</div>
        <style jsx>{css}</style>
      </section>
    )
  }

  return (
    <section className="rp">
      <div className="rp-title">Partes & relações</div>
      <div className="rp-list">
        {aggs.map((a) => (
          <Link key={a.entidadeId} href={`/entidades/${a.entidadeId}`} className="rp-item">
            <Building2 size={15} className="rp-item-icon" />
            <div className="rp-item-body">
              <div className="rp-item-nome">{a.nome}</div>
              <div className="rp-item-meta">
                {prettyPapel(a.papel)}
                {a.totalContratos > 1 && (
                  <>
                    <span className="rp-dot">·</span>
                    {a.totalContratos} contratos partilhados
                  </>
                )}
                {a.valorTotalAKZ > 0 && (
                  <>
                    <span className="rp-dot">·</span>
                    {fmtAkzShort(a.valorTotalAKZ)} exposição total
                  </>
                )}
              </div>
            </div>
            <ChevronRight size={13} className="rp-item-arrow" />
          </Link>
        ))}
      </div>
      <style jsx>{css}</style>
    </section>
  )
}

function prettyPapel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase().replaceAll('_', ' ')
}

function fmtAkzShort(akz: number): string {
  if (akz >= 1_000_000) return `${(akz / 1_000_000).toFixed(1).replace('.0', '')}M AOA`
  if (akz >= 1_000) return `${(akz / 1_000).toFixed(0)}k AOA`
  return `${akz.toFixed(0)} AOA`
}

const css = `
  .rp {
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border);
    border-radius: var(--k2-radius);
    padding: 14px 16px;
  }
  .rp-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--k2-text-mute);
    margin-bottom: 10px;
  }
  .rp-list { display: flex; flex-direction: column; gap: 6px; }
  .rp-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 11px;
    background: var(--k2-bg);
    border: 1px solid var(--k2-border);
    border-radius: var(--k2-radius-sm);
    color: var(--k2-text);
    text-decoration: none;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .rp-item:hover {
    border-color: var(--k2-border-strong);
    background: var(--k2-bg-hover);
  }
  .rp-item-icon { color: var(--k2-text-mute); flex-shrink: 0; }
  .rp-item-body { flex: 1; min-width: 0; }
  .rp-item-nome {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rp-item-meta {
    font-size: 11px;
    color: var(--k2-text-mute);
    margin-top: 1px;
  }
  .rp-dot { margin: 0 5px; opacity: 0.6; }
  .rp-item-arrow { color: var(--k2-text-mute); flex-shrink: 0; }
  .rp-empty, .rp-skel {
    font-size: 12px;
    color: var(--k2-text-mute);
  }
  .rp-skel {
    height: 44px;
    background: var(--k2-bg);
    border-radius: var(--k2-radius-sm);
    opacity: 0.5;
    animation: rp-pulse 1.4s ease-in-out infinite;
  }
  @keyframes rp-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
`
