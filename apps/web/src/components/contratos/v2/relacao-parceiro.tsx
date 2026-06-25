'use client'

/**
 * RelacaoParceiro — transforma o contrato de ilha em nó de um grafo
 * de relações comerciais.
 *
 * Onde o Contracko mostra "Counterparty: Inov Holding" e pára, o
 * Kamaia mostra "Inov Holding · 3 contratos · 30M AOA total · maior
 * exposição da carteira Hexa". O contrato deixa de ser isolado.
 *
 * Para cada parte do contrato, busca /entidades/:id/contratos e
 * agrega: quantos contratos partilhamos, valor total, e link para
 * a entidade. Isto dá contexto de RISCO e RELAÇÃO que nenhum CLM
 * genérico oferece.
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

interface ContratoDaEntidade {
  papel: string
  contrato: {
    id: string
    numeroInterno: string
    titulo: string
    estado: string
    valor: string | null
    moeda: string | null
  }
}

interface AggParceiro {
  entidadeId: string
  nome: string
  papel: string
  totalContratos: number
  valorTotalAKZ: number
  estadosActivos: number
}

function valorEmAKZ(valor: string | null): number {
  if (!valor) return 0
  const n = Number(valor)
  return Number.isFinite(n) ? n / 100 : 0
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

    Promise.all(
      partes.map(async (p) => {
        try {
          const rows = await api<ContratoDaEntidade[]>(
            `/entidades/${p.entidade.id}/contratos`,
            { token },
          )
          const list = Array.isArray(rows) ? rows : []
          const valorTotal = list.reduce(
            (acc, r) => acc + valorEmAKZ(r.contrato.valor),
            0,
          )
          const activos = list.filter((r) =>
            ['ACTIVO', 'REPOSITORIO', 'POS_ASSINATURA'].includes(
              r.contrato.estado,
            ),
          ).length
          return {
            entidadeId: p.entidade.id,
            nome: p.entidade.nome,
            papel: p.papel,
            totalContratos: list.length,
            valorTotalAKZ: valorTotal,
            estadosActivos: activos,
          } as AggParceiro
        } catch {
          return {
            entidadeId: p.entidade.id,
            nome: p.entidade.nome,
            papel: p.papel,
            totalContratos: 0,
            valorTotalAKZ: 0,
            estadosActivos: 0,
          } as AggParceiro
        }
      }),
    ).then((result) => {
      if (!cancelled) setAggs(result)
    })

    return () => {
      cancelled = true
    }
  }, [contratoId, partes, session?.accessToken])

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
