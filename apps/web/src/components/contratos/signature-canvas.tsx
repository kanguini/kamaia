'use client'

/**
 * Canvas de assinatura — touch + mouse.
 *
 * Pure-DOM (sem deps externas). Captura traços com pointer events
 * unificados, suaviza com quadratic curves entre pontos consecutivos,
 * exporta como dataURL PNG via `getDataUrl()`.
 *
 * Decisões:
 *  - Aspect ratio 3:1 (paisagem) — proporção típica de campo de
 *    assinatura em documentos
 *  - Fundo branco (não transparente) para parecer "papel" no PDF
 *  - DevicePixelRatio aware: traço nítido em retina
 *  - Linha grossa + linecap round → look natural
 *
 * Lei 1/11 (Angola): a assinatura DESENHADA_BROWSER é juridicamente
 * uma assinatura electrónica simples — eficácia probatória, não
 * qualificada. Para qualificada precisa de cert digital (TCAEAA).
 * Esse caminho está reservado em AssinaturaMetodo.CERTIFICADO_DIGITAL.
 */

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { Eraser } from 'lucide-react'

export interface SignatureCanvasHandle {
  getDataUrl: () => string | null
  clear: () => void
  isEmpty: () => boolean
}

interface Props {
  height?: number
  /** Texto sob o canvas — instrução curta. */
  hint?: string
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, Props>(
  function SignatureCanvas({ height = 160, hint }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const drawingRef = useRef(false)
    const lastPtRef = useRef<{ x: number; y: number } | null>(null)
    const dirtyRef = useRef(false)

    // Resize canvas para DPR + container width, mantendo o traço já feito.
    useEffect(() => {
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return

      const resize = () => {
        const dpr = window.devicePixelRatio || 1
        const cssW = wrap.clientWidth
        const cssH = height
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${cssH}px`
        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.scale(dpr, dpr)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, cssW, cssH)
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 2.2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
      resize()
      const obs = new ResizeObserver(resize)
      obs.observe(wrap)
      return () => obs.disconnect()
    }, [height])

    useImperativeHandle(
      ref,
      () => ({
        getDataUrl: () => {
          if (!dirtyRef.current) return null
          return canvasRef.current?.toDataURL('image/png') ?? null
        },
        clear: () => {
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const dpr = window.devicePixelRatio || 1
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
          dirtyRef.current = false
        },
        isEmpty: () => !dirtyRef.current,
      }),
      [],
    )

    const getPoint = (e: PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.setPointerCapture(e.pointerId)
      drawingRef.current = true
      lastPtRef.current = getPoint(e.nativeEvent)
    }
    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const pt = getPoint(e.nativeEvent)
      const last = lastPtRef.current
      if (!last) {
        lastPtRef.current = pt
        return
      }
      // Curva quadrática entre 3 pontos (smoothing simples)
      const mid = { x: (last.x + pt.x) / 2, y: (last.y + pt.y) / 2 }
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y)
      ctx.stroke()
      lastPtRef.current = pt
      dirtyRef.current = true
    }
    const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      drawingRef.current = false
      lastPtRef.current = null
    }

    const clearLocal = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      dirtyRef.current = false
    }

    return (
      <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            position: 'relative',
            border: '1px dashed var(--k2-border-strong, #94a3b8)',
            borderRadius: 'var(--k2-radius-sm)',
            background: '#fff',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              display: 'block',
              touchAction: 'none',
              cursor: 'crosshair',
              width: '100%',
              height,
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 12,
              bottom: 8,
              color: '#94a3b8',
              fontSize: 11,
              pointerEvents: 'none',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            X ____________________
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--k2-text-mute)',
          }}
        >
          <span>{hint ?? 'Desenha a tua assinatura acima.'}</span>
          <button
            type="button"
            onClick={clearLocal}
            style={{
              background: 'transparent',
              border: '1px solid var(--k2-border)',
              color: 'var(--k2-text-dim)',
              padding: '4px 8px',
              borderRadius: 'var(--k2-radius-sm)',
              cursor: 'pointer',
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Eraser size={11} /> Limpar
          </button>
        </div>
      </div>
    )
  },
)
