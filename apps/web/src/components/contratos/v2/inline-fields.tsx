'use client'

/**
 * InlineSentenceField — campo que se lê como frase.
 *
 * Em vez de 3 campos separados:
 *   [Notificação trigger:    Antes do termo  ▼]
 *   [Notificação quantidade: 1]
 *   [Notificação unidade:    Meses           ▼]
 *
 * Lê-se como prosa:
 *   "Notifica [1] [Meses ▼] antes do termo."
 *
 * Reduz ~40% do espaço vertical e o esforço cognitivo. Usado em
 * forms de termos do contrato (renovação, denúncia, revisão de
 * preço, garantias).
 *
 * Cada "fragmento" da frase é uma string OU um control (input,
 * select, switch). Renderiza-se em flex-wrap horizontal — quando
 * o espaço é apertado, os fragmentos quebram para nova linha
 * preservando a ordem das palavras.
 */

import { ReactNode } from 'react'

export type SentenceFragment =
  | string
  | {
      type: 'number'
      value: number | ''
      min?: number
      max?: number
      step?: number
      width?: number
      placeholder?: string
      onChange: (v: number | '') => void
    }
  | {
      type: 'select'
      value: string
      options: Array<{ value: string; label: string }>
      width?: number
      onChange: (v: string) => void
    }
  | {
      type: 'text'
      value: string
      width?: number
      placeholder?: string
      onChange: (v: string) => void
    }
  | {
      type: 'toggle'
      checked: boolean
      onChange: (v: boolean) => void
      onLabel?: string
      offLabel?: string
    }
  | {
      // Custom react node — escape hatch
      type: 'custom'
      render: () => ReactNode
    }

export function InlineSentenceField({
  fragments,
  hint,
}: {
  fragments: SentenceFragment[]
  hint?: string
}) {
  return (
    <div className="isf">
      <div className="isf-line">
        {fragments.map((f, i) => (
          <FragmentRenderer key={i} f={f} />
        ))}
      </div>
      {hint && <div className="isf-hint">{hint}</div>}
      <style jsx>{`
        .isf {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .isf-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--k2-text);
          line-height: 1.8;
        }
        .isf-hint {
          font-size: 11px;
          color: var(--k2-text-mute);
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}

function FragmentRenderer({ f }: { f: SentenceFragment }) {
  if (typeof f === 'string') {
    return <span>{f}</span>
  }
  if (f.type === 'number') {
    return (
      <input
        type="number"
        className="isf-input"
        value={f.value === '' ? '' : String(f.value)}
        min={f.min}
        max={f.max}
        step={f.step ?? 1}
        placeholder={f.placeholder}
        style={{ width: f.width ?? 58 }}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            f.onChange('')
            return
          }
          const n = Number(raw)
          if (Number.isFinite(n)) f.onChange(n)
        }}
      />
    )
  }
  if (f.type === 'select') {
    return (
      <select
        className="isf-select"
        value={f.value}
        style={{ width: f.width ?? 100 }}
        onChange={(e) => f.onChange(e.target.value)}
      >
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (f.type === 'text') {
    return (
      <input
        type="text"
        className="isf-input"
        value={f.value}
        placeholder={f.placeholder}
        style={{ width: f.width ?? 140 }}
        onChange={(e) => f.onChange(e.target.value)}
      />
    )
  }
  if (f.type === 'toggle') {
    return (
      <button
        type="button"
        onClick={() => f.onChange(!f.checked)}
        className={`isf-toggle ${f.checked ? 'on' : 'off'}`}
      >
        {f.checked ? f.onLabel ?? 'Sim' : f.offLabel ?? 'Não'}
      </button>
    )
  }
  return <>{f.render()}</>
}

// Estilos globais para os controls inline (uma vez, partilhados
// entre todas as instâncias). Posicionado num <style> ao fim da
// página para evitar SSR-mismatch com styled-jsx scoped.
function InlineFieldsStyles() {
  return (
    <style jsx global>{`
      .isf-input,
      .isf-select {
        background: var(--k2-bg-elev);
        border: 1px solid var(--k2-border);
        border-radius: var(--k2-radius-sm);
        padding: 4px 8px;
        font-family: inherit;
        font-size: 13px;
        color: var(--k2-text);
        height: 28px;
        line-height: 1;
      }
      .isf-input:focus,
      .isf-select:focus {
        outline: none;
        border-color: var(--k2-border-strong);
      }
      .isf-toggle {
        background: var(--k2-bg-elev);
        border: 1px solid var(--k2-border);
        border-radius: var(--k2-radius-sm);
        padding: 4px 10px;
        font-family: inherit;
        font-size: 12px;
        height: 28px;
        cursor: pointer;
        color: var(--k2-text);
      }
      .isf-toggle:hover {
        background: var(--k2-bg-hover);
      }
      .isf-toggle.on {
        background: var(--k2-accent);
        color: var(--k2-accent-fg);
        border-color: var(--k2-accent);
      }
    `}</style>
  )
}

export { InlineFieldsStyles }
