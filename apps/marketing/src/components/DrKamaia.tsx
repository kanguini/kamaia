'use client'

/**
 * Dr. Kamaia — orbe de energia (conselheiro de IA).
 *
 * Uma esfera luminosa, viva: corpo com gradiente índigo→azul→violeta e um
 * reflexo especular, dois redemoinhos de energia que giram em sentidos
 * opostos (mistura "screen"), um halo que respira e partículas em órbita.
 * Afinada para fundo claro — o brilho colorido destaca-se sobre o branco.
 *
 * Por baixo, a "voz": cicla frases de valor com efeito de escrita.
 * Sem dependências (CSS puro). Respeita prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react'

const FALAS = [
  'A renovação do CT-2026-0148 vence em 86 dias. Quer agendar a decisão de denúncia?',
  'Imposto de Selo estimado em 875 000 Kz para este contrato. Confirme antes de submeter à AGT.',
  'Importei 312 contratos da carteira herdada. Extraí partes, valores e datas-chave de cada um.',
  'O arrendamento com o BFA tem janela de denúncia a fechar em 21 dias. Está sinalizado.',
]

export function DrKamaia() {
  const [idx, setIdx] = useState(0)
  const [texto, setTexto] = useState('')
  const reduMotion = useRef(false)

  useEffect(() => {
    reduMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let char = 0
    let apagar = false
    let timer: ReturnType<typeof setTimeout>

    const fala = FALAS[idx]

    if (reduMotion.current) {
      setTexto(fala)
      timer = setTimeout(() => setIdx((i) => (i + 1) % FALAS.length), 5200)
      return () => clearTimeout(timer)
    }

    const passo = () => {
      if (!apagar) {
        char++
        setTexto(fala.slice(0, char))
        if (char >= fala.length) {
          timer = setTimeout(() => {
            apagar = true
            passo()
          }, 2600)
          return
        }
        timer = setTimeout(passo, 26)
      } else {
        char -= 3
        setTexto(fala.slice(0, Math.max(0, char)))
        if (char <= 0) {
          setIdx((i) => (i + 1) % FALAS.length)
          return
        }
        timer = setTimeout(passo, 12)
      }
    }
    timer = setTimeout(passo, 400)
    return () => clearTimeout(timer)
  }, [idx])

  return (
    <div className="dk-wrap">
      <div className="dk-stage" role="img" aria-label="Dr. Kamaia — conselheiro de IA">
        <div className="dk-halo" aria-hidden="true" />

        <div className="dk-orb" aria-hidden="true">
          <div className="dk-swirl dk-swirl-a" />
          <div className="dk-swirl dk-swirl-b" />
          <div className="dk-spec" />
          <div className="dk-core" />
        </div>

        <div className="dk-ring" aria-hidden="true" />

        <div className="dk-orbit dk-orbit-a" aria-hidden="true">
          <span className="dk-dot dk-dot-lg" />
        </div>
        <div className="dk-orbit dk-orbit-b" aria-hidden="true">
          <span className="dk-dot dk-dot-sm" />
        </div>

        <div className="dk-badge">
          <span className="dk-live" aria-hidden="true" />
          Dr. Kamaia · conselheiro de IA
        </div>
      </div>

      <div className="dk-say" aria-live="polite">
        <p>
          {texto}
          <span className="dk-caret" aria-hidden="true" />
        </p>
      </div>

      <style jsx>{`
        .dk-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 30px;
          width: 100%;
          padding-bottom: 8px;
        }
        .dk-stage {
          position: relative;
          width: clamp(220px, 34vw, 320px);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
        }

        /* halo de energia — brilho que respira */
        .dk-halo {
          position: absolute;
          inset: -16%;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(74, 125, 255, 0.4) 0%,
            rgba(124, 92, 255, 0.22) 38%,
            transparent 66%
          );
          filter: blur(30px);
          animation: dk-breathe 6s ease-in-out infinite;
        }

        /* corpo da esfera */
        .dk-orb {
          position: relative;
          width: 78%;
          height: 78%;
          border-radius: 50%;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(
              circle at 70% 78%,
              rgba(124, 92, 255, 0.85) 0%,
              transparent 56%
            ),
            radial-gradient(
              circle at 50% 50%,
              #2a4fd0 0%,
              #18255e 58%,
              #0b1130 100%
            );
          box-shadow:
            inset 0 0 40px rgba(8, 12, 36, 0.7),
            inset -8px -10px 30px rgba(8, 12, 36, 0.55),
            0 26px 60px -20px rgba(38, 60, 150, 0.6);
          animation: dk-float 7s ease-in-out infinite;
        }

        /* redemoinhos de energia */
        .dk-swirl {
          position: absolute;
          inset: -20%;
          border-radius: 50%;
          mix-blend-mode: screen;
        }
        .dk-swirl-a {
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            rgba(70, 211, 255, 0.6) 14%,
            transparent 32%,
            rgba(124, 92, 255, 0.5) 56%,
            transparent 72%,
            rgba(74, 125, 255, 0.6) 92%,
            transparent 100%
          );
          opacity: 0.85;
          animation: dk-spin 13s linear infinite;
        }
        .dk-swirl-b {
          background: conic-gradient(
            from 180deg,
            transparent 0%,
            rgba(124, 92, 255, 0.5) 20%,
            transparent 44%,
            rgba(70, 211, 255, 0.45) 68%,
            transparent 88%
          );
          opacity: 0.6;
          animation: dk-spin-rev 19s linear infinite;
        }

        /* reflexo especular */
        .dk-spec {
          position: absolute;
          top: 12%;
          left: 16%;
          width: 42%;
          height: 34%;
          border-radius: 50%;
          background: radial-gradient(
            circle at 40% 38%,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(255, 255, 255, 0.25) 30%,
            transparent 60%
          );
          filter: blur(2px);
        }

        /* núcleo pulsante */
        .dk-core {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 14%;
          height: 14%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, #eaf1ff 0%, #46d3ff 55%, transparent 75%);
          box-shadow: 0 0 18px rgba(70, 211, 255, 0.9);
          animation: dk-pulse 2.6s ease-in-out infinite;
        }

        /* anel de contenção */
        .dk-ring {
          position: absolute;
          width: 92%;
          height: 92%;
          border-radius: 50%;
          border: 1px solid rgba(52, 96, 217, 0.22);
          box-shadow: inset 0 0 0 1px rgba(124, 92, 255, 0.06);
        }

        /* partículas em órbita */
        .dk-orbit {
          position: absolute;
          inset: 0;
          transform-origin: 50% 50%;
        }
        .dk-orbit-a {
          animation: dk-spin 14s linear infinite;
        }
        .dk-orbit-b {
          inset: 8%;
          animation: dk-spin-rev 9s linear infinite;
        }
        .dk-dot {
          position: absolute;
          top: 0;
          left: 50%;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .dk-dot-lg {
          width: 9px;
          height: 9px;
          background: #4a7dff;
          box-shadow: 0 0 12px rgba(74, 125, 255, 0.9);
        }
        .dk-dot-sm {
          width: 6px;
          height: 6px;
          background: #7c5cff;
          box-shadow: 0 0 10px rgba(124, 92, 255, 0.85);
        }

        /* etiqueta */
        .dk-badge {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          border-radius: 999px;
          border: 1px solid var(--k2-border);
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          padding: 6px 13px;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--k2-text-dim);
          box-shadow: 0 8px 24px -12px rgba(20, 30, 80, 0.4);
          z-index: 2;
        }
        .dk-live {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1f9d57;
          box-shadow: 0 0 0 3px rgba(31, 157, 87, 0.18);
          animation: dk-pulse 2.4s ease-in-out infinite;
        }

        /* voz */
        .dk-say {
          max-width: 460px;
          min-height: 80px;
          border-radius: 16px;
          border: 1px solid var(--k2-border);
          background: #ffffff;
          padding: 16px 18px;
          position: relative;
          box-shadow: 0 20px 50px -28px rgba(20, 30, 80, 0.35);
        }
        .dk-say::before {
          content: '';
          position: absolute;
          top: -7px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 12px;
          height: 12px;
          background: #ffffff;
          border-left: 1px solid var(--k2-border);
          border-top: 1px solid var(--k2-border);
        }
        .dk-say p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--k2-text-dim);
          text-align: center;
        }
        .dk-caret {
          display: inline-block;
          width: 2px;
          height: 1.05em;
          margin-left: 2px;
          vertical-align: -0.18em;
          background: var(--k2-accent);
          animation: dk-caret 1s step-end infinite;
        }

        @keyframes dk-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes dk-spin-rev {
          to { transform: rotate(-360deg); }
        }
        @keyframes dk-breathe {
          0%, 100% { opacity: 0.6; transform: scale(0.97); }
          50%       { opacity: 1; transform: scale(1.05); }
        }
        @keyframes dk-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes dk-pulse {
          0%, 100% { opacity: 0.65; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 1; transform: translate(-50%, -50%) scale(1.18); }
        }
        .dk-live {
          /* o badge não usa translate central; pulso simples */
          animation: dk-pulse-simple 2.4s ease-in-out infinite;
        }
        @keyframes dk-pulse-simple {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
        @keyframes dk-caret {
          50% { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .dk-halo,
          .dk-orb,
          .dk-swirl,
          .dk-core,
          .dk-orbit,
          .dk-live,
          .dk-caret {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
