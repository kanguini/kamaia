'use client'

/**
 * DiffDrawer — comparação line-by-line entre duas versões de contrato.
 *
 * Mostra:
 *  - Stats no topo (+N / -M / =K)
 *  - Selector "Comparar com" (default: versão imediatamente anterior)
 *  - Toggle view: unified (uma coluna, +/-/= por linha) vs split (lado a lado)
 *
 * Cores: verde para `add`, vermelho para `remove`, neutro para `equal`.
 * Texto monospace para alinhamento visual de markdown.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { GitCompare, Columns2, AlignLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerHeader, DrawerBody } from '@/components/ui/drawer'
import { Select } from '@/components/ui/input'

export interface DiffVersaoRef {
  id: string
  ordem: number
  versao: string
  createdAt: string
}

interface WordOp {
  op: 'equal' | 'add' | 'remove'
  text: string
}

interface DiffLine {
  op: 'equal' | 'add' | 'remove'
  text: string
  oldLine?: number
  newLine?: number
  /** Diff word-level inline quando linha foi pareada como modificação. */
  wordOps?: WordOp[]
  /** Id de pareamento (mesma linha lógica). */
  pairId?: number
}

interface DiffResponse {
  lines: DiffLine[]
  stats: {
    added: number
    removed: number
    unchanged: number
    hashOld: string
    hashNew: string
  }
  versaoNova: DiffVersaoRef
  versaoAnterior: DiffVersaoRef
}

interface VersaoOption {
  id: string
  ordem: number
  versao: string
}

type View = 'unified' | 'split'

export function DiffDrawer({
  open,
  onClose,
  contratoId,
  versaoId,
  versaoLabel,
  /** Outras versões disponíveis (excluindo a própria). */
  outrasVersoes,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  versaoId: string | null
  versaoLabel?: string
  outrasVersoes: VersaoOption[]
}) {
  const { data: session } = useSession()
  const [against, setAgainst] = useState<string>('')
  const [diff, setDiff] = useState<DiffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<View>('unified')

  // Reset & fetch sempre que abrir ou mudar a referência
  useEffect(() => {
    if (!open || !versaoId || !session?.accessToken) {
      setDiff(null)
      setErr(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const url = `/contratos/${contratoId}/versoes/${versaoId}/diff${
      against ? `?against=${against}` : ''
    }`
    api<DiffResponse>(url, { token: session.accessToken })
      .then((r) => {
        if (!cancelled) setDiff(r)
      })
      .catch((e: { error?: string }) => {
        if (!cancelled) setErr(e?.error ?? 'Erro a calcular diff')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, contratoId, versaoId, against, session?.accessToken])

  return (
    <Drawer open={open} onClose={onClose} width={1100}>
      <DrawerHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <GitCompare size={18} /> Comparar versões
          </span>
        }
        subtitle={
          versaoLabel ? `Mudanças face a versão anterior · ${versaoLabel}` : 'Mudanças face a versão anterior'
        }
        onClose={onClose}
      />
      <DrawerBody>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Comparar com:
            <Select
              value={against}
              onChange={(e) => setAgainst(e.target.value)}
              style={{ minWidth: 240 }}
            >
              <option value="">Versão imediatamente anterior</option>
              {outrasVersoes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versao} (#{v.ordem})
                </option>
              ))}
            </Select>
          </label>

          <div style={{ flex: 1 }} />

          {diff && (
            <div style={{ display: 'inline-flex', gap: 6, fontSize: 12 }}>
              <Badge variant="success">+{diff.stats.added}</Badge>
              <Badge variant="danger">−{diff.stats.removed}</Badge>
              <Badge variant="default">={diff.stats.unchanged}</Badge>
            </div>
          )}

          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius-sm)',
              overflow: 'hidden',
            }}
          >
            <ViewBtn
              active={view === 'unified'}
              onClick={() => setView('unified')}
              label="Unified"
              icon={<AlignLeft size={12} />}
            />
            <ViewBtn
              active={view === 'split'}
              onClick={() => setView('split')}
              label="Split"
              icon={<Columns2 size={12} />}
            />
          </div>
        </div>

        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}

        {loading && (
          <div style={{ padding: 24, color: 'var(--k2-text-mute)' }}>A calcular diff…</div>
        )}

        {diff && !loading && (
          <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>
              <strong>Anterior:</strong> {diff.versaoAnterior.versao}
              {diff.versaoAnterior.id && ` (#${diff.versaoAnterior.ordem})`}
            </span>
            <span>
              <strong>Nova:</strong> {diff.versaoNova.versao} (#{diff.versaoNova.ordem})
            </span>
            <span>
              <strong>Hash:</strong> {diff.stats.hashOld.slice(0, 6)} → {diff.stats.hashNew.slice(0, 6)}
            </span>
          </div>
        )}

        {diff && !loading && (
          view === 'unified'
            ? <UnifiedView lines={diff.lines} />
            : <SplitView lines={diff.lines} />
        )}
      </DrawerBody>
    </Drawer>
  )
}

// ─── Views ─────────────────────────────────

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <pre style={preBaseStyle}>
      {lines.map((l, i) => (
        <UnifiedRow key={i} line={l} />
      ))}
    </pre>
  )
}

function UnifiedRow({ line }: { line: DiffLine }) {
  const colors = colorsFor(line.op)
  const prefix = line.op === 'add' ? '+' : line.op === 'remove' ? '−' : ' '
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 36px 16px 1fr',
        background: colors.bg,
        color: colors.fg,
      }}
    >
      <span style={lineNumCellStyle}>{line.oldLine ?? ''}</span>
      <span style={lineNumCellStyle}>{line.newLine ?? ''}</span>
      <span style={{ ...lineNumCellStyle, textAlign: 'center' }}>{prefix}</span>
      <span style={{ padding: '0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <InlineText line={line} />
      </span>
    </div>
  )
}

/**
 * Render do texto da linha. Quando `wordOps` está presente, mostra
 * o diff word-level com cada palavra removida tachada e cada
 * adicionada sublinhada — em vez de pintar a linha inteira na cor
 * da operação. Para linhas sem `wordOps` cai no texto plain.
 */
function InlineText({ line }: { line: DiffLine }) {
  if (!line.wordOps || line.wordOps.length === 0) {
    return <>{line.text || ' '}</>
  }
  return (
    <>
      {line.wordOps.map((t, i) => {
        if (t.op === 'equal') return <span key={i}>{t.text}</span>
        if (t.op === 'remove') {
          return (
            <span
              key={i}
              style={{
                background: 'rgba(220,38,38,0.22)',
                textDecoration: 'line-through',
                color: '#7f1d1d',
                borderRadius: 2,
              }}
            >
              {t.text}
            </span>
          )
        }
        return (
          <span
            key={i}
            style={{
              background: 'rgba(16,185,129,0.22)',
              color: '#065f46',
              borderRadius: 2,
              fontWeight: 500,
            }}
          >
            {t.text}
          </span>
        )
      })}
    </>
  )
}

function SplitView({ lines }: { lines: DiffLine[] }) {
  // Pareamento simples: equal → ambos lados; remove → só esquerdo; add → só direito.
  // Mantemos a ordem temporal para preservar contexto.
  const rows = useMemo(() => alignSplit(lines), [lines])
  return (
    <pre style={preBaseStyle}>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <SplitCell side="L" line={r.left} />
          <SplitCell side="R" line={r.right} />
        </div>
      ))}
    </pre>
  )
}

function SplitCell({ line }: { side: 'L' | 'R'; line: DiffLine | null }) {
  if (!line) return <span style={{ background: 'rgba(0,0,0,0.02)' }}>&nbsp;</span>
  const colors = colorsFor(line.op)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        background: colors.bg,
        color: colors.fg,
        borderRight: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <span style={lineNumCellStyle}>{line.oldLine ?? line.newLine ?? ''}</span>
      <span style={{ padding: '0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <InlineText line={line} />
      </span>
    </div>
  )
}

function alignSplit(lines: DiffLine[]): Array<{ left: DiffLine | null; right: DiffLine | null }> {
  const rows: Array<{ left: DiffLine | null; right: DiffLine | null }> = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.op === 'equal') {
      rows.push({ left: l, right: l })
      i++
    } else if (l.op === 'remove') {
      // Agrupar com `add` seguinte para parear lado-a-lado quando possível.
      if (i + 1 < lines.length && lines[i + 1].op === 'add') {
        rows.push({ left: l, right: lines[i + 1] })
        i += 2
      } else {
        rows.push({ left: l, right: null })
        i++
      }
    } else {
      // add isolado
      rows.push({ left: null, right: l })
      i++
    }
  }
  return rows
}

// ─── UI helpers ─────────────────────────────

function ViewBtn({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px',
        background: active ? 'var(--k2-bg-hover)' : 'transparent',
        border: 'none',
        borderRight: '1px solid var(--k2-border)',
        color: active ? 'var(--k2-text)' : 'var(--k2-text-dim)',
        fontSize: 12,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function colorsFor(op: 'add' | 'remove' | 'equal'): { bg: string; fg: string } {
  if (op === 'add')    return { bg: 'rgba(16,185,129,0.10)', fg: '#065f46' }
  if (op === 'remove') return { bg: 'rgba(220,38,38,0.10)',  fg: '#7f1d1d' }
  return { bg: 'transparent', fg: 'var(--k2-text)' }
}

const lineNumCellStyle: React.CSSProperties = {
  color: 'var(--k2-text-mute)',
  padding: '0 6px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 11,
  userSelect: 'none',
  borderRight: '1px solid rgba(0,0,0,0.06)',
}

const preBaseStyle: React.CSSProperties = {
  background: 'var(--k2-bg-elev)',
  border: '1px solid var(--k2-border)',
  borderRadius: 'var(--k2-radius-sm)',
  fontFamily: 'var(--k2-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
  fontSize: 12,
  lineHeight: 1.55,
  overflow: 'auto',
  maxHeight: '70vh',
  margin: 0,
  padding: 0,
  whiteSpace: 'normal',
}
