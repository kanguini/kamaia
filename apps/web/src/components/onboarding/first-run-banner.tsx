'use client'

/**
 * FirstRunBanner — banner do primeiro arranque.
 *
 * Aparece na homepage do Dr. Kamaia quando o tenant tem 0 contratos.
 * Oferece 2 caminhos contextuais:
 *   1. "Importar carteira existente" → /contratos com modo bulk
 *   2. "Criar primeiro contrato com o Dr. Kamaia" → abre o side panel
 *      com prompt pré-populado
 *
 * Estratégia: a maior fricção do CLM B2B é o "cold start". Quem
 * compra normalmente tem uma carteira herdada para registar — e
 * sem isso, todas as features ficam vazias e o produto sente-se
 * morto. O banner reduz isso a 1 clique.
 *
 * Esconde-se automaticamente quando:
 *  - Tenant tem ≥ 1 contrato
 *  - Utilizador dispensa via "Não mostrar mais" (persistido em
 *    localStorage por tenant)
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Upload, Sparkles, X } from 'lucide-react'
import { api, getActiveTenantId } from '@/lib/api'
import { useKamaiaAI } from '@/components/kamaia-ai/kamaia-ai-provider'

interface Status {
  usage: { contratos: { usado: number } }
}

const DISMISS_KEY_PREFIX = 'kamaia.onboarding.dismissed.'

export function FirstRunBanner() {
  const { data: session } = useSession()
  const { setOpen, send } = useKamaiaAI()
  const [show, setShow] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return
    const tid = getActiveTenantId()
    if (!tid) return
    setTenantId(tid)

    // Check dismiss
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY_PREFIX + tid) === '1'
    } catch {
      // ignore
    }
    if (dismissed) {
      setShow(false)
      return
    }

    api<Status>('/billing/status', { token: session.accessToken })
      .then((s) => {
        // Mostra apenas se o tenant tem 0 contratos
        // Onda C.1.5: strict equality — só mostra quando o servidor
        // confirma 0. Sem ?? fallback, evita-se spam quando API
        // devolve resposta malformada durante incident.
        setShow(s.usage?.contratos?.usado === 0)
      })
      .catch(() => setShow(false))
  }, [session?.accessToken])

  const dismiss = () => {
    setShow(false)
    if (tenantId) {
      try {
        localStorage.setItem(DISMISS_KEY_PREFIX + tenantId, '1')
      } catch {
        // ignore
      }
    }
  }

  const startWithAI = async () => {
    setOpen(true)
    await send(
      'Quero criar o meu primeiro contrato. Guia-me com perguntas — começa pelo título e o tipo.',
    )
  }

  if (!show) return null

  return (
    <div className="frb">
      <div className="frb-head">
        <div className="frb-title">Bem-vindo ao Kamaia.</div>
        <button
          type="button"
          onClick={dismiss}
          className="frb-close"
          aria-label="Dispensar"
        >
          <X size={12} />
        </button>
      </div>
      <p className="frb-hint">
        Para começares, escolhe um caminho. Podes mudar depois.
      </p>
      <div className="frb-paths">
        <Link href="/contratos?onboard=import" className="frb-path">
          <Upload size={16} className="frb-path-icon" />
          <div>
            <div className="frb-path-title">Importar carteira existente</div>
            <div className="frb-path-sub">
              Tens contratos já assinados em PDF/Word? Regista-os e põe-nos
              a ser geridos — datas, obrigações e compliance angolano.
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => void startWithAI()}
          className="frb-path"
        >
          <Sparkles size={16} className="frb-path-icon" />
          <div>
            <div className="frb-path-title">
              Criar primeiro contrato com o Dr. Kamaia
            </div>
            <div className="frb-path-sub">
              Diz ao Dr. Kamaia o que precisas. Ele faz as perguntas certas e
              monta o contrato.
            </div>
          </div>
        </button>
      </div>

      <style jsx>{`
        .frb {
          width: 100%;
          padding: 14px 16px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .frb-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .frb-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .frb-close {
          background: transparent;
          border: none;
          color: var(--k2-text-mute);
          cursor: pointer;
          padding: 2px;
        }
        .frb-close:hover {
          color: var(--k2-text);
        }
        .frb-hint {
          margin: 0;
          font-size: 12px;
          color: var(--k2-text-mute);
        }
        .frb-paths {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        @media (max-width: 600px) {
          .frb-paths {
            grid-template-columns: 1fr;
          }
        }
        .frb-path {
          display: flex;
          gap: 10px;
          padding: 12px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          text-decoration: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .frb-path:hover {
          background: var(--k2-bg-hover);
          border-color: var(--k2-border-strong);
        }
        .frb-path-icon {
          color: var(--k2-text-mute);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .frb-path-title {
          font-size: 13px;
          font-weight: 500;
        }
        .frb-path-sub {
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-top: 2px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
