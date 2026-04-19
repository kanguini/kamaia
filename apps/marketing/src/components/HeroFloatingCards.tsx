'use client'

import { useRef, useEffect } from 'react'
import { DashboardMockup } from './DashboardMockup'

/**
 * Hero floating cards + dashboard mockup.
 *
 * Client component so we can wire up mouse-parallax via requestAnimationFrame.
 * Each card has a `data-depth` attribute controlling how strongly it reacts
 * to mouse movement (higher = moves more). The CSS `translate` property is
 * used (separate from `transform`) so it doesn't conflict with the CSS float
 * animations applied on the inner div of each card.
 *
 * Layout: cards are absolutely positioned over the mockup container. The
 * outer div (data-depth) handles parallax translation; the inner div carries
 * the CSS keyframe float animation.
 */
export function HeroFloatingCards() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let rafId = 0
    // Lerped mouse position (-1 … 1 per axis)
    let curX = 0
    let curY = 0
    let targetX = 0
    let targetY = 0

    const onMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2
      targetY = (e.clientY / window.innerHeight - 0.5) * 2
    }

    const tick = () => {
      // Smooth interpolation — ~0.3 s lag at 60 fps
      curX += (targetX - curX) * 0.07
      curY += (targetY - curY) * 0.07

      const cards = containerRef.current?.querySelectorAll<HTMLElement>('[data-depth]')
      cards?.forEach((el) => {
        const d = parseFloat(el.dataset.depth ?? '10')
        // CSS `translate` property composes independently of `transform`
        el.style.translate = `${curX * d}px ${curY * d}px`
      })

      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div className="relative z-10 flex justify-center px-4 pb-12 mt-4">
      <div ref={containerRef} className="relative w-full max-w-5xl mx-auto">

        {/* Glow orb behind the mockup */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] top-[3%] -z-0 h-[45%] rounded-full blur-[100px]"
          style={{
            background:
              'radial-gradient(ellipse, rgba(74,125,255,0.24) 0%, rgba(41,82,217,0.09) 55%, transparent 80%)',
          }}
        />

        {/* ── Card 1: IA Assistente — top right ── */}
        <div
          data-depth="18"
          className="absolute -top-6 right-2 sm:right-8 lg:right-14 z-20 hidden sm:block"
        >
          <div style={{ animation: 'k2-float-a 6s ease-in-out infinite' }}>
            <div className="rounded-2xl border border-white/14 bg-black/60 backdrop-blur-xl px-4 py-3 w-[210px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-gradient-to-r from-[#b24aff] to-[#4a7dff] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                  IA
                </span>
                <span className="text-[11px] font-semibold text-white">Assistente</span>
              </div>
              <p className="text-[10px] text-white/55 leading-snug">Petição redigida em 18s</p>
              <div className="mt-2.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-[#b24aff] to-[#4a7dff]" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Processos activos — top left (NEW) ── */}
        <div
          data-depth="14"
          className="absolute -top-4 left-2 sm:left-8 lg:left-14 z-20 hidden sm:block"
        >
          <div style={{ animation: 'k2-float-b 9s ease-in-out infinite 0.4s' }}>
            <div className="rounded-2xl border border-white/14 bg-black/60 backdrop-blur-xl px-4 py-3 w-[188px]">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ background: '#4a7dff', boxShadow: '0 0 0 4px rgba(74,125,255,0.2)' }}
                />
                <span className="text-[11px] font-semibold text-white">Processos</span>
              </div>
              <p className="text-[10px] text-white/55 leading-snug">12 activos · 3 encerrados</p>
              <div className="mt-2.5 flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    style={{ background: i < 3 ? '#4a7dff' : 'rgba(255,255,255,0.1)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 3: Prazo urgente — left, 1/3 height ── */}
        <div
          data-depth="22"
          className="absolute top-[30%] -left-2 lg:-left-10 z-20 hidden lg:block"
        >
          <div style={{ animation: 'k2-float-b 7s ease-in-out infinite' }}>
            <div className="flex items-center gap-3 rounded-2xl border border-white/14 bg-black/60 backdrop-blur-xl px-4 py-3 w-[200px]">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: '#e46b7a', boxShadow: '0 0 0 4px rgba(228,107,122,0.18)' }}
              />
              <div>
                <p className="text-[11px] font-semibold text-white">Prazo em 2 dias</p>
                <p className="mt-0.5 text-[10px] text-white/50">Proc. 2024/0847 · Cível</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 4: Receita — right, middle height ── */}
        <div
          data-depth="16"
          className="absolute top-[42%] -right-2 lg:-right-10 z-20 hidden lg:block"
        >
          <div style={{ animation: 'k2-float-c 8s ease-in-out infinite 1.2s' }}>
            <div className="flex items-center gap-3 rounded-2xl border border-white/14 bg-black/60 backdrop-blur-xl px-4 py-3 w-[164px]">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: '#6be49a', boxShadow: '0 0 0 4px rgba(107,228,154,0.18)' }}
              />
              <div>
                <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Este mês</p>
                <p className="mt-0.5 text-sm font-semibold text-white">+14% receita</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 5: Timer activo — bottom right (NEW) ── */}
        <div
          data-depth="20"
          className="absolute bottom-28 right-2 sm:right-8 lg:right-14 z-20 hidden lg:block"
        >
          <div style={{ animation: 'k2-float-a 8.5s ease-in-out infinite 2s' }}>
            <div className="rounded-2xl border border-white/14 bg-black/60 backdrop-blur-xl px-4 py-3 w-[178px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-white">Timer activo</span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: '#6be49a', animation: 'k2-pulse 2s ease-in-out infinite' }}
                />
              </div>
              <p className="text-[18px] font-mono font-medium text-white tracking-[0.08em]">
                02:34:18
              </p>
              <p className="mt-0.5 text-[10px] text-white/45">Proc. 2024/0312 · Cível</p>
            </div>
          </div>
        </div>

        {/* ── Card 6: Novo cliente — bottom left (NEW) ── */}
        <div
          data-depth="18"
          className="absolute bottom-24 left-2 sm:left-8 lg:left-14 z-20 hidden sm:block"
        >
          <div style={{ animation: 'k2-float-c 7.5s ease-in-out infinite 0.8s' }}>
            <div className="flex items-center gap-3 rounded-2xl border border-white/14 bg-black/60 backdrop-blur-xl px-4 py-3 w-[194px]">
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px]"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
              >
                +
              </span>
              <div>
                <p className="text-[11px] font-semibold text-white">Novo cliente</p>
                <p className="mt-0.5 text-[10px] text-white/50">Adriano M. · onboarding</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Dashboard mockup — slight parallax (depth 5) ── */}
        <div data-depth="5">
          <div
            className="relative z-10"
            style={{
              transform: 'perspective(1800px) rotateX(4deg)',
              transformOrigin: 'center bottom',
            }}
          >
            <DashboardMockup />
          </div>
        </div>

      </div>
    </div>
  )
}
