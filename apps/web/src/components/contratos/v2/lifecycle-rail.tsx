'use client'

/**
 * Rail do ciclo de vida — mode-aware.
 *
 * Um contrato CRIADO percorre os 6 marcos lineares (Entrada → … →
 * Terminação). Um contrato HERDADO entra a meio: a rail colapsa para
 * Importado → Em vigor → Renovação → Terminação, para não fingir que
 * passou por elaboração/negociação/assinatura.
 *
 * Toda a lógica (passos + passo actual) vem do resolver puro
 * `contratoRail()` em shared-types — este componente só desenha.
 */

import { Check } from 'lucide-react'
import { ContratoEstado, ContratoOrigem, contratoRail } from '@kamaia/shared-types'

interface Props {
  estado: ContratoEstado
  origem: ContratoOrigem
}

export function LifecycleRail({ estado, origem }: Props) {
  const { steps, currentIndex, cancelado } = contratoRail(estado, origem)

  return (
    <div className="lr" role="group" aria-label="Ciclo de vida do contrato">
      <span className="lr-cap">Ciclo de vida</span>
      <div className="lr-track">
        {steps.map((step, i) => {
          const done = !cancelado && i < currentIndex
          const curr = !cancelado && i === currentIndex
          return (
            <div
              key={step.key}
              className={`lr-step ${done ? 'done' : ''} ${curr ? 'curr' : ''}`}
              aria-current={curr ? 'step' : undefined}
            >
              <span className="lr-dot">
                {done ? <Check size={13} /> : <span className="lr-pip" />}
              </span>
              <span className="lr-lab">{step.label}</span>
            </div>
          )
        })}
      </div>
      {cancelado && <span className="lr-cancel">Contrato cancelado</span>}

      <style jsx>{`
        .lr {
          position: relative;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          padding: 26px 16px 16px;
        }
        .lr-cap {
          position: absolute;
          top: 9px;
          left: 16px;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--k2-text-mute);
          font-weight: 600;
        }
        .lr-track {
          display: flex;
          align-items: flex-start;
        }
        .lr-step {
          flex: 1;
          min-width: 0;
          text-align: center;
          position: relative;
          padding-top: 4px;
        }
        .lr-dot {
          position: relative;
          z-index: 2;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--k2-bg);
          border: 1.5px solid var(--k2-border);
          color: var(--k2-text-mute);
        }
        .lr-pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.5;
        }
        .lr-step.done .lr-dot {
          background: var(--k2-text-dim);
          border-color: var(--k2-text-dim);
          color: var(--k2-bg);
        }
        .lr-step.curr .lr-dot {
          background: var(--k2-accent);
          border-color: var(--k2-accent);
          color: var(--k2-accent-fg);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--k2-accent) 22%, transparent);
        }
        .lr-step.curr .lr-pip {
          opacity: 1;
        }
        .lr-lab {
          display: block;
          margin-top: 8px;
          font-size: 11px;
          color: var(--k2-text-mute);
        }
        .lr-step.curr .lr-lab {
          color: var(--k2-text);
          font-weight: 500;
        }
        .lr-step.done .lr-lab {
          color: var(--k2-text-dim);
        }
        /* Conector entre passos */
        .lr-step::before {
          content: '';
          position: absolute;
          top: 18px;
          left: -50%;
          width: 100%;
          height: 2px;
          background: var(--k2-border);
          z-index: 1;
        }
        .lr-step:first-child::before {
          display: none;
        }
        .lr-step.done::before,
        .lr-step.curr::before {
          background: var(--k2-text-dim);
        }
        .lr-cancel {
          display: block;
          margin-top: 12px;
          font-size: 11.5px;
          color: var(--k2-bad);
          text-align: center;
        }
      `}</style>
    </div>
  )
}
