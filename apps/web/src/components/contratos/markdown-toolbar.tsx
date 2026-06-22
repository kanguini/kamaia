'use client'

/**
 * Toolbar de formatação markdown para o editor de contratos.
 *
 * Manipula directamente o textarea via ref: aplica transformações
 * preservando selecção/cursor, dispara `onChange` sintético, e mantém
 * o focus para que o utilizador continue a escrever sem clicar de novo.
 *
 * Suporta keyboard shortcuts (Cmd/Ctrl + B/I/K) — handler ligado pelo
 * caller no próprio textarea (evita doubles-handlers).
 *
 * Decisão: NÃO é WYSIWYG. O utilizador continua a ver markdown puro
 * no editor — a toolbar é só atalho. Razão: queremos preservar a
 * fonte canónica em markdown para diff/versão/IA, e cursor-preserving
 * num WYSIWYG real é dramaticamente mais complexo.
 */

import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Quote,
  Minus,
  type LucideIcon,
} from 'lucide-react'

export interface FormatAction {
  label: string
  icon: LucideIcon
  /** Atalho display (e.g. "⌘B"). */
  shortcut?: string
  /**
   * Aplica a transformação. Recebe o estado actual do textarea +
   * setter (`updateValue`). A implementação devolve nada — a
   * transformação faz-se in-place via `updateValue`.
   */
  apply: (ctx: {
    value: string
    selectionStart: number
    selectionEnd: number
    updateValue: (next: string, cursorRange: [number, number]) => void
  }) => void
}

// ─── Helpers ──────────────────────────────────────────

/** Envolve a selecção em prefix/suffix. Se vazia, insere placeholder. */
function wrap(prefix: string, suffix: string, placeholder = 'texto'): FormatAction['apply'] {
  return ({ value, selectionStart, selectionEnd, updateValue }) => {
    const selected = value.slice(selectionStart, selectionEnd) || placeholder
    const next =
      value.slice(0, selectionStart) +
      prefix + selected + suffix +
      value.slice(selectionEnd)
    const cursorStart = selectionStart + prefix.length
    const cursorEnd = cursorStart + selected.length
    updateValue(next, [cursorStart, cursorEnd])
  }
}

/** Prepende `marker` à linha actual (ou linhas seleccionadas). */
function lineMarker(marker: string): FormatAction['apply'] {
  return ({ value, selectionStart, selectionEnd, updateValue }) => {
    // Determina as fronteiras das linhas que tocam a selecção
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const nextNewline = value.indexOf('\n', selectionEnd)
    const lineEnd = nextNewline === -1 ? value.length : nextNewline

    const block = value.slice(lineStart, lineEnd)
    const transformed = block
      .split('\n')
      .map((line) => {
        // Se já tem o marker (ou outro heading marker), substitui
        const stripped = line.replace(/^(#{1,6}\s|[-*]\s|\d+\.\s|>\s)/, '')
        return marker + stripped
      })
      .join('\n')

    const next =
      value.slice(0, lineStart) + transformed + value.slice(lineEnd)

    // Coloca cursor no fim do bloco transformado
    const cursor = lineStart + transformed.length
    updateValue(next, [cursor, cursor])
  }
}

/** Insere um link `[texto](url)`. URL prompt-asked. */
const insertLink: FormatAction['apply'] = ({
  value,
  selectionStart,
  selectionEnd,
  updateValue,
}) => {
  const selected = value.slice(selectionStart, selectionEnd) || 'texto'
  const url = window.prompt('URL (https://…):', 'https://')
  if (!url) return
  const insertion = `[${selected}](${url})`
  const next =
    value.slice(0, selectionStart) + insertion + value.slice(selectionEnd)
  const cursorStart = selectionStart + 1
  const cursorEnd = cursorStart + selected.length
  updateValue(next, [cursorStart, cursorEnd])
}

/** Insere uma linha horizontal acima/abaixo da linha actual. */
const insertDivider: FormatAction['apply'] = ({
  value,
  selectionStart,
  updateValue,
}) => {
  // Inserção em linha-nova-própria
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const before = value.slice(0, lineStart)
  const after = value.slice(lineStart)
  const insertion = '\n---\n\n'
  const next = before + insertion + after
  const cursor = before.length + insertion.length
  updateValue(next, [cursor, cursor])
}

// ─── Actions ──────────────────────────────────────────

export const FORMAT_ACTIONS: FormatAction[] = [
  { label: 'Negrito',  icon: Bold,         shortcut: '⌘B', apply: wrap('**', '**', 'texto') },
  { label: 'Itálico',  icon: Italic,       shortcut: '⌘I', apply: wrap('*',  '*',  'texto') },
  { label: 'Código',   icon: Code,                          apply: wrap('`',  '`',  'código') },
  { label: 'Heading 1', icon: Heading1,                     apply: lineMarker('# ') },
  { label: 'Heading 2', icon: Heading2,                     apply: lineMarker('## ') },
  { label: 'Heading 3', icon: Heading3,                     apply: lineMarker('### ') },
  { label: 'Lista',     icon: List,                         apply: lineMarker('- ') },
  { label: 'Numerada',  icon: ListOrdered,                  apply: lineMarker('1. ') },
  { label: 'Citação',   icon: Quote,                        apply: lineMarker('> ') },
  { label: 'Link',      icon: LinkIcon,    shortcut: '⌘K', apply: insertLink },
  { label: 'Divisor',   icon: Minus,                        apply: insertDivider },
]

// ─── Componente ───────────────────────────────────────

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const runAction = (action: FormatAction) => {
    const ta = textareaRef.current
    if (!ta || disabled) return
    const selectionStart = ta.selectionStart
    const selectionEnd = ta.selectionEnd
    action.apply({
      value,
      selectionStart,
      selectionEnd,
      updateValue: (next, [cursorStart, cursorEnd]) => {
        onChange(next)
        // Restaura selecção/cursor depois do re-render
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(cursorStart, cursorEnd)
        })
      },
    })
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatação markdown"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: 4,
        background: 'var(--k2-bg-elev-2, var(--k2-bg-elev))',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius-sm)',
        marginBottom: -1,
      }}
    >
      {FORMAT_ACTIONS.map((a, i) => {
        const Icon = a.icon
        // Separadores visuais: depois de Código, depois de H3, depois de Numerada
        const showSep = i === 3 || i === 6 || i === 9
        return (
          <ToolbarBtn
            key={a.label}
            label={a.label}
            shortcut={a.shortcut}
            onClick={() => runAction(a)}
            disabled={disabled}
            sepAfter={showSep}
          >
            <Icon size={14} />
          </ToolbarBtn>
        )
      })}
    </div>
  )
}

function ToolbarBtn({
  children,
  label,
  shortcut,
  onClick,
  disabled,
  sepAfter,
}: {
  children: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  sepAfter?: boolean
}) {
  return (
    <>
      <button
        type="button"
        onMouseDown={(e) => {
          // Evita perder o focus do textarea quando se clica num botão
          e.preventDefault()
        }}
        onClick={onClick}
        disabled={disabled}
        title={shortcut ? `${label} (${shortcut})` : label}
        aria-label={label}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          color: disabled ? 'var(--k2-text-mute)' : 'var(--k2-text-dim)',
          padding: '6px 8px',
          borderRadius: 'var(--k2-radius-sm)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          opacity: disabled ? 0.4 : 1,
          transition: 'background 80ms',
        }}
        onMouseEnter={(e) => {
          if (disabled) return
          e.currentTarget.style.background = 'var(--k2-bg-hover, rgba(255,255,255,0.04))'
          e.currentTarget.style.color = 'var(--k2-text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = disabled
            ? 'var(--k2-text-mute)'
            : 'var(--k2-text-dim)'
        }}
      >
        {children}
      </button>
      {sepAfter && (
        <span
          aria-hidden
          style={{
            width: 1,
            background: 'var(--k2-border)',
            margin: '4px 4px',
          }}
        />
      )}
    </>
  )
}

// ─── Keyboard shortcuts (helper para o textarea) ──────

/**
 * Handler para `onKeyDown` do textarea. Devolve `true` se a tecla
 * foi consumida (e o caller deve fazer `e.preventDefault()`).
 */
export function applyKeyboardShortcut(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (next: string) => void,
): boolean {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return false
  const key = e.key.toLowerCase()
  const map: Record<string, FormatAction | undefined> = {
    b: FORMAT_ACTIONS.find((a) => a.label === 'Negrito'),
    i: FORMAT_ACTIONS.find((a) => a.label === 'Itálico'),
    k: FORMAT_ACTIONS.find((a) => a.label === 'Link'),
  }
  const action = map[key]
  if (!action) return false
  action.apply({
    value,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    updateValue: (next, [cursorStart, cursorEnd]) => {
      onChange(next)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(cursorStart, cursorEnd)
      })
    },
  })
  return true
}
