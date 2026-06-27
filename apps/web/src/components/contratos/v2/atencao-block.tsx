'use client'

/**
 * AtencaoBlock — o hero do contract detail redesenhado.
 *
 * Lidera a página com "Precisa da tua atenção": as 3-5 coisas que
 * este contrato precisa de ti AGORA, cada uma resolvível in-line.
 *
 * Diferença face ao Contracko (e à v2 anterior, que era clone):
 *   - Contracko: vês metadata, agarras o assistente para perguntar.
 *   - Kamaia: o produto diz-te o que precisa antes de perguntares,
 *     e resolves sem sair da página.
 *
 * Cada acção liga a um endpoint real:
 *   acto.concluir       → PATCH /compliance/actos/:id/concluir
 *   acto.em-curso       → PATCH /compliance/actos/:id/em-curso
 *   acto.inaplicavel    → PATCH /compliance/actos/:id/inaplicavel (motivo)
 *   vigencia.bloquear   → POST  /contratos/:id/denunciar
 *   vigencia.renovar    → acknowledge (dismiss local)
 *   vigencia.adenda     → navega para fluxo de adenda
 *   obrigacao.cumprir   → (placeholder honesto até endpoint existir)
 */

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bell,
  ShieldAlert,
  CheckCircle2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  computarAtencao,
  type ActoInput,
  type DataChaveInput,
  type ObrigacaoInput,
  type ContratoAtencaoInput,
  type AtencaoItem,
  type AtencaoAccao,
} from './atencao-engine'

interface Props {
  contratoId: string
  contrato: ContratoAtencaoInput
  actos: ActoInput[]
  datas: DataChaveInput[]
  obrigacoes: ObrigacaoInput[]
  /** Chamado após qualquer resolução para o pai refrescar dados. */
  onResolved: () => void
}

export function AtencaoBlock({
  contratoId,
  contrato,
  actos,
  datas,
  obrigacoes,
  onResolved,
}: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [motivoFor, setMotivoFor] = useState<AtencaoItem | null>(null)
  const [motivo, setMotivo] = useState('')

  const items = useMemo(
    () =>
      computarAtencao({ contrato, actos, datas, obrigacoes }).filter(
        (i) => !dismissed.has(i.id),
      ),
    [contrato, actos, datas, obrigacoes, dismissed],
  )

  if (items.length === 0) {
    return (
      <div className="atc atc-clear">
        <CheckCircle2 size={16} className="atc-clear-icon" />
        <div>
          <div className="atc-clear-title">Tudo em dia</div>
          <div className="atc-clear-sub">
            Sem actos pendentes, prazos iminentes ou obrigações em atraso.
          </div>
        </div>
        <style jsx>{clearCss}</style>
      </div>
    )
  }

  const runAccao = async (item: AtencaoItem, accao: AtencaoAccao) => {
    if (!session?.accessToken) return
    const token = session.accessToken

    // Acções que precisam de input abrem fluxo separado
    if (accao.kind === 'acto.inaplicavel') {
      setMotivo('')
      setMotivoFor(item)
      return
    }
    if (accao.kind === 'vigencia.adenda') {
      router.push(`/contratos?onboard=adenda&parent=${contratoId}`)
      return
    }

    setBusy(item.id)
    try {
      if (accao.kind === 'acto.concluir' && item.ref?.actoId) {
        await api(`/compliance/actos/${item.ref.actoId}/concluir`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({}),
        })
      } else if (accao.kind === 'acto.em-curso' && item.ref?.actoId) {
        await api(`/compliance/actos/${item.ref.actoId}/em-curso`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({}),
        })
      } else if (accao.kind === 'vigencia.bloquear-renovacao') {
        await api(`/contratos/${contratoId}/denunciar`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            motivo: 'Denúncia da renovação automática via painel de atenção.',
          }),
        })
      } else if (accao.kind === 'vigencia.renovar') {
        // Acknowledgement — a renovação já está activa, isto é só
        // confirmação consciente. Dismiss local + sem chamada.
        setDismissed((s) => new Set(s).add(item.id))
        return
      } else if (accao.kind === 'obrigacao.cumprir') {
        // Honesto: endpoint de marcar obrigação cumprida ainda não
        // está exposto. Dismiss local com nota.
        setDismissed((s) => new Set(s).add(item.id))
        return
      }
      onResolved()
    } catch {
      // toast vem em sprint posterior; por agora não dismiss
    } finally {
      setBusy(null)
    }
  }

  const confirmInaplicavel = async () => {
    if (!motivoFor || !session?.accessToken || motivo.trim().length < 5) return
    setBusy(motivoFor.id)
    try {
      if (motivoFor.ref?.actoId) {
        await api(`/compliance/actos/${motivoFor.ref.actoId}/inaplicavel`, {
          method: 'PATCH',
          token: session.accessToken,
          body: JSON.stringify({ motivo: motivo.trim() }),
        })
        onResolved()
      }
      setMotivoFor(null)
    } catch {
      /* keep open */
    } finally {
      setBusy(null)
    }
  }

  const Icon = (cat: AtencaoItem['categoria']) =>
    cat === 'compliance' ? ShieldAlert : cat === 'vigencia' ? AlertTriangle : Bell

  return (
    <div className="atc">
      <div className="atc-head">
        <AlertTriangle size={13} className="atc-head-icon" />
        <span className="atc-head-title">Precisa da tua atenção</span>
        <span className="atc-head-count">{items.length}</span>
      </div>

      <div className="atc-list">
        {items.map((item) => {
          const ItemIcon = Icon(item.categoria)
          return (
            <div key={item.id} className={`atc-item sev-${item.severidade}`}>
              <ItemIcon size={15} className="atc-item-icon" />
              <div className="atc-item-body">
                <div className="atc-item-titulo">{item.titulo}</div>
                <div className="atc-item-detalhe">{item.detalhe}</div>
                <div className="atc-item-accoes">
                  {item.accoes.map((accao) => (
                    <button
                      key={accao.kind + accao.label}
                      type="button"
                      className={`atc-btn atc-btn-${accao.variant}`}
                      disabled={busy === item.id}
                      onClick={() => void runAccao(item, accao)}
                    >
                      {busy === item.id ? '…' : accao.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="atc-item-dismiss"
                aria-label="Dispensar"
                onClick={() => setDismissed((s) => new Set(s).add(item.id))}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Motivo modal para "Não aplicável" */}
      {motivoFor && (
        <div className="atc-motivo-ov" onClick={() => setMotivoFor(null)}>
          <div className="atc-motivo" onClick={(e) => e.stopPropagation()}>
            <div className="atc-motivo-title">
              Marcar como não aplicável
            </div>
            <div className="atc-motivo-sub">
              {motivoFor.titulo}. Justifica para o audit trail (defesa em
              auditoria fiscal/regulatória).
            </div>
            <textarea
              className="atc-motivo-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Operação isenta nos termos do art. X do CIS."
              rows={3}
              autoFocus
            />
            <div className="atc-motivo-actions">
              <button
                type="button"
                className="atc-btn atc-btn-ghost"
                onClick={() => setMotivoFor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="atc-btn atc-btn-primary"
                disabled={motivo.trim().length < 5 || busy === motivoFor.id}
                onClick={() => void confirmInaplicavel()}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{mainCss}</style>
    </div>
  )
}

const clearCss = `
  .atc-clear {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border);
    border-radius: var(--k2-radius);
  }
  .atc-clear-icon { color: var(--k2-good); flex-shrink: 0; }
  .atc-clear-title { font-size: 13px; font-weight: 600; color: var(--k2-text); }
  .atc-clear-sub { font-size: 12px; color: var(--k2-text-mute); margin-top: 2px; }
`

const mainCss = `
  .atc {
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border-strong);
    border-radius: var(--k2-radius);
    overflow: hidden;
  }
  .atc-head {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 11px 16px;
    border-bottom: 1px solid var(--k2-border);
    background: var(--k2-bg-elev-2);
  }
  .atc-head-icon { color: var(--k2-warn); }
  .atc-head-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--k2-text);
  }
  .atc-head-count {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    background: var(--k2-warn);
    color: #fff;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
  }
  .atc-list { display: flex; flex-direction: column; }
  .atc-item {
    display: flex;
    gap: 11px;
    padding: 13px 16px;
    border-bottom: 1px solid var(--k2-border);
    position: relative;
  }
  .atc-item:last-child { border-bottom: none; }
  .atc-item.sev-critico { border-left: 3px solid var(--k2-bad); }
  .atc-item.sev-aviso { border-left: 3px solid var(--k2-warn); }
  .atc-item.sev-info { border-left: 3px solid var(--k2-border-strong); }
  .atc-item-icon { flex-shrink: 0; margin-top: 1px; }
  .atc-item.sev-critico .atc-item-icon { color: var(--k2-bad); }
  .atc-item.sev-aviso .atc-item-icon { color: var(--k2-warn); }
  .atc-item-body { flex: 1; min-width: 0; }
  .atc-item-titulo {
    font-size: 13px;
    font-weight: 600;
    color: var(--k2-text);
  }
  .atc-item-detalhe {
    font-size: 11.5px;
    color: var(--k2-text-mute);
    margin-top: 2px;
    line-height: 1.45;
  }
  .atc-item-accoes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 9px;
  }
  .atc-btn {
    font-size: 11.5px;
    font-weight: 500;
    font-family: inherit;
    padding: 5px 10px;
    border-radius: var(--k2-radius-sm);
    cursor: pointer;
    border: 1px solid var(--k2-border);
    transition: background 120ms ease, border-color 120ms ease;
  }
  .atc-btn-primary {
    background: var(--k2-accent);
    color: var(--k2-accent-fg);
    border-color: var(--k2-accent);
  }
  .atc-btn-primary:hover:not(:disabled) { opacity: 0.9; }
  .atc-btn-secondary {
    background: var(--k2-bg-elev-2);
    color: var(--k2-text);
  }
  .atc-btn-secondary:hover:not(:disabled) { background: var(--k2-bg-hover); }
  .atc-btn-ghost {
    background: transparent;
    color: var(--k2-text-mute);
  }
  .atc-btn-ghost:hover:not(:disabled) { color: var(--k2-text); }
  .atc-btn:disabled { opacity: 0.5; cursor: default; }
  .atc-item-dismiss {
    background: transparent;
    border: none;
    color: var(--k2-text-mute);
    cursor: pointer;
    padding: 2px;
    height: fit-content;
    flex-shrink: 0;
  }
  .atc-item-dismiss:hover { color: var(--k2-text); }

  .atc-motivo-ov {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    display: grid; place-items: center;
    z-index: 60;
  }
  .atc-motivo {
    width: min(440px, 92vw);
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border-strong);
    border-radius: var(--k2-radius);
    padding: 18px;
  }
  .atc-motivo-title { font-size: 14px; font-weight: 600; color: var(--k2-text); }
  .atc-motivo-sub { font-size: 12px; color: var(--k2-text-mute); margin-top: 4px; line-height: 1.5; }
  .atc-motivo-input {
    width: 100%;
    margin-top: 12px;
    background: var(--k2-bg-elev-2);
    border: 1px solid var(--k2-border);
    border-radius: var(--k2-radius-sm);
    padding: 9px 11px;
    color: var(--k2-text);
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
    outline: none;
  }
  .atc-motivo-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
`
