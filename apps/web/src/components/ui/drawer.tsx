'use client'

/**
 * Kamaia 2.0 side drawer.
 *
 * Slide-in panel from the right, dark overlay behind, ESC + click-outside
 * to close. Designed to host quick-edit detail views from list pages
 * (Projectos, Processos, Clientes, etc.) without navigating away.
 *
 * The drawer is intentionally chrome-only — body content is whatever the
 * caller renders. A standard <DrawerHeader/DrawerSection> set of helpers
 * is exported for consistent typography.
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Drawer({
  open,
  onClose,
  children,
  width = 560,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <style jsx>{`
        .drawer-ov {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms ease;
          z-index: 60;
        }
        .drawer-ov.open {
          opacity: 1;
          pointer-events: auto;
        }
        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(${width}px, 92vw);
          background: var(--k2-bg);
          border-left: 1px solid var(--k2-border);
          box-shadow: -12px 0 40px -12px rgba(0, 0, 0, 0.5);
          transform: translateX(100%);
          transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
          z-index: 70;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .drawer.open {
          transform: translateX(0);
        }
      `}</style>

      <div
        className={`drawer-ov ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={ref}
        className={`drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </aside>
    </>
  )
}

export function DrawerHeader({
  title,
  subtitle,
  badges,
  onClose,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badges?: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="dh">
      <style jsx>{`
        .dh {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 22px 24px 18px;
          border-bottom: 1px solid var(--k2-border);
        }
        .dh-body {
          flex: 1;
          min-width: 0;
        }
        .dh-title {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--k2-text);
          line-height: 1.3;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dh-sub {
          font-size: 12px;
          color: var(--k2-text-dim);
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dh-close {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text-mute);
          cursor: pointer;
          transition: all 120ms;
          flex-shrink: 0;
        }
        .dh-close:hover {
          color: var(--k2-text);
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-hover);
        }
      `}</style>
      <div className="dh-body">
        <div className="dh-title">{title}</div>
        {subtitle && <div className="dh-sub">{subtitle}</div>}
        {badges && <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badges}</div>}
      </div>
      <button className="dh-close" onClick={onClose} aria-label="Fechar">
        <X size={14} />
      </button>
    </div>
  )
}

export function DrawerBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="db">
      <style jsx>{`
        .db {
          flex: 1;
          overflow-y: auto;
          padding: 22px 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
      `}</style>
      {children}
    </div>
  )
}

export function DrawerSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <style jsx>{`
        .ds-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .ds-title {
          font-size: 10px;
          color: var(--k2-text-mute);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .ds-line {
          flex: 1;
          height: 1px;
          background: var(--k2-border);
        }
      `}</style>
      <div className="ds-head">
        <span className="ds-title">{title}</span>
        <span className="ds-line" />
      </div>
      {children}
    </section>
  )
}

export function DrawerFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="df">
      <style jsx>{`
        .df {
          padding: 14px 24px;
          border-top: 1px solid var(--k2-border);
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--k2-bg-elev);
        }
      `}</style>
      {children}
    </div>
  )
}
