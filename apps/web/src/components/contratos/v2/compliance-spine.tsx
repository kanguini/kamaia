'use client'

/**
 * ComplianceSpine — o compliance angolano como coluna vertebral do
 * contrato, não como secção entre cinco.
 *
 * Diferença face ao clone v2: aqui o compliance é organizado pelas
 * 5 CATEGORIAS regulatórias angolanas, e CADA UMA mostra estado
 * mesmo quando não há acto. "Notário — não aplicável" é informação
 * tranquilizadora: o utilizador sabe que o engine olhou e decidiu.
 * Um CLM genérico (Contracko) não tem isto de todo.
 *
 * As 5 categorias:
 *   1. Imposto de Selo (TGIS)
 *   2. Registos públicos (Predial, Comercial, Automóvel, IAPI)
 *   3. BNA / Lei Cambial (operações com não-residentes)
 *   4. AGT (retenção IRT na fonte)
 *   5. Reconhecimento notarial
 */

import {
  Stamp,
  Landmark,
  Banknote,
  Receipt,
  FileSignature,
} from 'lucide-react'
import type { ActoInput } from './atencao-engine'

interface Categoria {
  key: string
  label: string
  icon: React.ElementType
  /** Prefixos de ActoRegulatorioTipo que caem nesta categoria. */
  tipos: string[]
  /** Nota quando NÃO há acto detectado (tranquilizador). */
  vazioNota: string
}

// Os `tipos` têm de bater EXACTAMENTE com o enum ActoRegulatorioTipo
// de shared-types (IMPOSTO_SELO, REGISTO_IP_IAPI, BNA_AUTORIZACAO,
// BNA_REGISTO, AGT_RETENCAO_IRT, AGT_OUTRO, TRADUCAO_JURAMENTADA,
// SECTORIAL_OUTRO) — senão as categorias mostram "vazio" mesmo com
// actos detectados.
const CATEGORIAS: Categoria[] = [
  {
    key: 'tgis',
    label: 'Imposto de Selo',
    icon: Stamp,
    tipos: ['IMPOSTO_SELO'],
    vazioNota: 'Sem incidência detectada para este tipo/valor.',
  },
  {
    key: 'registos',
    label: 'Registos públicos',
    icon: Landmark,
    tipos: [
      'REGISTO_PREDIAL',
      'REGISTO_COMERCIAL',
      'REGISTO_AUTOMOVEL',
      'REGISTO_IP_IAPI',
    ],
    vazioNota: 'Não exigido para este tipo de contrato.',
  },
  {
    key: 'bna',
    label: 'BNA / Lei Cambial',
    icon: Banknote,
    tipos: ['BNA_AUTORIZACAO', 'BNA_REGISTO'],
    vazioNota: 'Partes residentes — sem operação cambial regulada.',
  },
  {
    key: 'agt',
    label: 'AGT — Retenção IRT',
    icon: Receipt,
    tipos: ['AGT_RETENCAO_IRT', 'AGT_OUTRO'],
    vazioNota: 'Sem retenção na fonte aplicável.',
  },
  {
    key: 'notario',
    label: 'Notário & traduções',
    icon: FileSignature,
    tipos: ['RECONHECIMENTO_NOTARIAL', 'TRADUCAO_JURAMENTADA'],
    vazioNota: 'Não obrigatório por lei para este contrato.',
  },
]

function estadoLabel(estado: string): { label: string; tone: string } {
  switch (estado) {
    case 'PENDENTE':
      return { label: 'Pendente', tone: 'warn' }
    case 'EM_CURSO':
      return { label: 'Em curso', tone: 'warn' }
    case 'CONCLUIDO':
      return { label: 'Concluído', tone: 'good' }
    case 'NAO_APLICAVEL':
      return { label: 'Não aplicável', tone: 'mute' }
    case 'DISPENSADO':
      return { label: 'Dispensado', tone: 'mute' }
    case 'FALHOU':
      return { label: 'Falhou', tone: 'bad' }
    case 'EXPIRADO':
      return { label: 'Prazo expirado', tone: 'bad' }
    default:
      return { label: estado, tone: 'mute' }
  }
}

function fmtMoneyShort(centavosStr: string | null, moeda: string | null): string | null {
  if (!centavosStr) return null
  const n = Number(centavosStr)
  if (!Number.isFinite(n)) return null
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(
    n / 100,
  )} ${moeda ?? 'AOA'}`
}

export function ComplianceSpine({ actos }: { actos: ActoInput[] }) {
  // Conta actos activos (não dispensados nem concluídos) para o badge
  const activos = actos.filter(
    (a) =>
      a.estado === 'PENDENTE' ||
      a.estado === 'EM_CURSO' ||
      a.estado === 'FALHOU' ||
      a.estado === 'EXPIRADO',
  ).length

  return (
    <section className="cs">
      <header className="cs-head">
        <span className="cs-title">Compliance angolano</span>
        {activos > 0 ? (
          <span className="cs-badge cs-badge-warn">{activos} activo{activos > 1 ? 's' : ''}</span>
        ) : (
          <span className="cs-badge cs-badge-good">tudo tratado</span>
        )}
      </header>

      <div className="cs-cats">
        {CATEGORIAS.map((cat) => {
          const catActos = actos.filter((a) => cat.tipos.includes(a.tipo))
          return (
            <div key={cat.key} className="cs-cat">
              <div className="cs-cat-head">
                <cat.icon size={13} className="cs-cat-icon" />
                <span className="cs-cat-label">{cat.label}</span>
              </div>
              {catActos.length === 0 ? (
                <div className="cs-cat-vazio">{cat.vazioNota}</div>
              ) : (
                <div className="cs-cat-actos">
                  {catActos.map((a) => {
                    const est = estadoLabel(a.estado)
                    const valor = fmtMoneyShort(a.valorLiquidar, a.baseMoeda)
                    return (
                      <div key={a.id} className="cs-acto">
                        <span className={`cs-acto-dot tone-${est.tone}`} />
                        <div className="cs-acto-text">
                          <div className="cs-acto-line">
                            <span className="cs-acto-est">{est.label}</span>
                            {a.tgisVerbaNumero && (
                              <span className="cs-acto-verba">
                                Verba {a.tgisVerbaNumero}
                              </span>
                            )}
                            {valor && <span className="cs-acto-valor">{valor}</span>}
                          </div>
                          {a.referenciaLegal && (
                            <div className="cs-acto-ref">{a.referenciaLegal}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .cs {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          overflow: hidden;
        }
        .cs-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 16px;
          border-bottom: 1px solid var(--k2-border);
        }
        .cs-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--k2-text);
        }
        .cs-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .cs-badge-warn { background: var(--k2-warn); color: #fff; }
        .cs-badge-good { background: var(--k2-bg-elev-2); color: var(--k2-good); }
        .cs-cats { display: flex; flex-direction: column; }
        .cs-cat {
          padding: 11px 16px;
          border-bottom: 1px solid var(--k2-border);
        }
        .cs-cat:last-child { border-bottom: none; }
        .cs-cat-head {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 5px;
        }
        .cs-cat-icon { color: var(--k2-text-mute); }
        .cs-cat-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .cs-cat-vazio {
          font-size: 11px;
          color: var(--k2-text-mute);
          padding-left: 19px;
          line-height: 1.4;
        }
        .cs-cat-actos {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 19px;
        }
        .cs-acto {
          display: flex;
          gap: 7px;
        }
        .cs-acto-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .tone-warn { background: var(--k2-warn); }
        .tone-good { background: var(--k2-good); }
        .tone-bad { background: var(--k2-bad); }
        .tone-mute { background: var(--k2-text-mute); }
        .cs-acto-text { flex: 1; min-width: 0; }
        .cs-acto-line {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 7px;
        }
        .cs-acto-est {
          font-size: 12px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .cs-acto-verba {
          font-size: 10px;
          color: var(--k2-text-dim);
        }
        .cs-acto-valor {
          font-size: 11px;
          color: var(--k2-text-dim);
          font-variant-numeric: tabular-nums;
        }
        .cs-acto-ref {
          font-size: 10.5px;
          color: var(--k2-text-mute);
          margin-top: 2px;
          line-height: 1.4;
        }
      `}</style>
    </section>
  )
}
