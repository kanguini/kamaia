'use client'

/**
 * Dr. Kamaia — personificação animada do conselheiro de contratos.
 *
 * Um emblema/selo (autoridade, registo, contrato) com o monograma K,
 * aura que respira, anel que gira e uma partícula em órbita (atenção).
 * Por baixo, uma "voz": cicla frases de valor com efeito de escrita —
 * o Dr. Kamaia a falar do que está a vigiar na carteira.
 *
 * Sem dependências; SVG + CSS. Respeita prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react'

const FALAS = [
  'A renovação do CT-2026-0148 vence em 86 dias. Quer agendar a decisão de denúncia?',
  'Imposto de Selo estimado em 875 000 Kz para este contrato. Confirme antes de submeter à AGT.',
  'Importei 312 contratos da carteira herdada. Extraí partes, valores e datas-chave de cada um.',
  'O arrendamento com o BFA tem janela de denúncia a fechar em 21 dias. Está sinalizado.',
]

export function DrKamaia() {
  const ticks = Array.from({ length: 60 })

  // Efeito de escrita ciclando as falas.
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
      <div className="dk-stage">
        <div className="dk-aura" aria-hidden="true" />
        <svg viewBox="0 0 200 200" className="dk-svg" role="img" aria-label="Dr. Kamaia">
          <defs>
            <radialGradient id="dk-disc" cx="50%" cy="38%" r="70%">
              <stop offset="0%" stopColor="#1a2340" />
              <stop offset="100%" stopColor="#0a0e1c" />
            </radialGradient>
            <linearGradient id="dk-k" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cdd9ff" />
              <stop offset="100%" stopColor="#9cb6ff" />
            </linearGradient>
          </defs>

          {/* Anel de selo com marcas — gira devagar */}
          <g className="dk-ring">
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(156,182,255,0.22)" strokeWidth="1" />
            <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(156,182,255,0.12)" strokeWidth="1" />
            {ticks.map((_, i) => {
              const grande = i % 5 === 0
              return (
                <line
                  key={i}
                  x1="100"
                  y1={grande ? 8 : 10}
                  x2="100"
                  y2={grande ? 15 : 13}
                  stroke="rgba(156,182,255,0.5)"
                  strokeWidth={grande ? 1.4 : 0.8}
                  transform={`rotate(${(i * 360) / 60} 100 100)`}
                />
              )
            })}
          </g>

          {/* Disco central */}
          <circle cx="100" cy="100" r="72" fill="url(#dk-disc)" stroke="rgba(156,182,255,0.25)" strokeWidth="1" />

          {/* Monograma K */}
          <g className="dk-mono" stroke="url(#dk-k)" strokeWidth="7" strokeLinecap="round" fill="none">
            <line x1="80" y1="74" x2="80" y2="126" />
            <line x1="80" y1="100" x2="118" y2="74" />
            <line x1="80" y1="100" x2="118" y2="126" />
          </g>

          {/* Ponto da assinatura (a "fechar" o selo) */}
          <circle cx="100" cy="100" r="3" fill="#6be49a" className="dk-core" />

          {/* Partícula em órbita — atenção */}
          <g className="dk-orbit">
            <circle cx="100" cy="8" r="3.4" fill="#9cb6ff" />
          </g>
        </svg>

        {/* Etiqueta */}
        <div className="dk-badge">
          <span className="dk-live" aria-hidden="true" />
          Dr. Kamaia · conselheiro de contratos
        </div>
      </div>

      {/* Voz */}
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
          gap: 26px;
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
        .dk-aura {
          position: absolute;
          inset: -14%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124,154,255,0.32), transparent 62%);
          filter: blur(26px);
          animation: dk-breathe 6s ease-in-out infinite;
        }
        .dk-svg {
          position: relative;
          width: 100%;
          height: 100%;
          z-index: 1;
        }
        .dk-ring {
          transform-origin: 100px 100px;
          animation: dk-spin 60s linear infinite;
        }
        .dk-orbit {
          transform-origin: 100px 100px;
          animation: dk-spin 9s linear infinite;
        }
        .dk-mono {
          animation: dk-glow 6s ease-in-out infinite;
        }
        .dk-core {
          animation: dk-pulse 2.6s ease-in-out infinite;
        }
        .dk-badge {
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 14, 28, 0.78);
          backdrop-filter: blur(8px);
          padding: 6px 13px;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.78);
          z-index: 2;
        }
        .dk-live {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6be49a;
          box-shadow: 0 0 0 3px rgba(107, 228, 154, 0.22);
          animation: dk-pulse 2.4s ease-in-out infinite;
        }
        .dk-say {
          max-width: 440px;
          min-height: 78px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(8px);
          padding: 16px 18px;
          position: relative;
        }
        .dk-say::before {
          content: '';
          position: absolute;
          top: -7px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 12px;
          height: 12px;
          background: rgba(20, 24, 38, 0.9);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .dk-say p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.82);
          text-align: center;
        }
        .dk-caret {
          display: inline-block;
          width: 2px;
          height: 1.05em;
          margin-left: 2px;
          vertical-align: -0.18em;
          background: #9cb6ff;
          animation: dk-caret 1s step-end infinite;
        }
        @keyframes dk-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes dk-breathe {
          0%, 100% {
            opacity: 0.55;
            transform: scale(0.96);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }
        @keyframes dk-glow {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(156, 182, 255, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 9px rgba(156, 182, 255, 0.65));
          }
        }
        @keyframes dk-pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }
        @keyframes dk-caret {
          50% {
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dk-ring,
          .dk-orbit,
          .dk-aura,
          .dk-mono,
          .dk-core,
          .dk-live,
          .dk-caret {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
