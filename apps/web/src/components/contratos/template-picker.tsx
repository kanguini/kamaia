'use client'

/**
 * TemplatePicker — escolhe um Template do tipo de contrato seleccionado
 * + mostra preview (read-only) do conteúdo + lista os placeholders
 * detectados no template, marcando quais já estão preenchidos pelos
 * dados do form actual.
 *
 * Carrega via GET /templates?tipoId=<id>. Quando o utilizador muda o
 * tipo no form, este componente refaz fetch (key controlada pelo
 * caller via prop).
 */

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileText, Check } from 'lucide-react'
import { api } from '@/lib/api'

interface Template {
  id: string
  nome: string
  descricao: string | null
  versao: number
  conteudo: string
}

export function TemplatePicker({
  tipoId,
  value,
  onChange,
  /** Caminhos no contexto que estão preenchidos — marca o placeholder como ✓. */
  pathsPresentes,
}: {
  tipoId: string | null
  value: string | null
  onChange: (templateId: string | null, preview?: string) => void
  pathsPresentes?: Set<string>
}) {
  const { data: session, status } = useSession()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!tipoId || status !== 'authenticated' || !session?.accessToken) {
      setTemplates([])
      return
    }
    let cancelled = false
    setLoading(true)
    api<Template[]>(`/templates?tipoId=${tipoId}`, {
      token: session.accessToken,
    })
      .then((data) => {
        if (cancelled) return
        setTemplates(data ?? [])
        setErr(null)
      })
      .catch((e: { error?: string }) => {
        if (!cancelled) setErr(e?.error ?? 'Erro a carregar templates')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tipoId, session?.accessToken, status])

  const selected = useMemo(
    () => templates.find((t) => t.id === value) ?? null,
    [templates, value],
  )

  const placeholdersDetectados = useMemo(() => {
    if (!selected) return []
    return extractPlaceholders(selected.conteudo)
  }, [selected])

  if (!tipoId) {
    return (
      <div style={emptyStateStyle}>
        Escolhe primeiro o tipo de contrato — os templates aparecem aqui.
      </div>
    )
  }

  if (loading) {
    return <div style={{ ...emptyStateStyle, color: 'var(--k2-text-mute)' }}>A carregar templates…</div>
  }

  if (err) {
    return <div style={{ ...emptyStateStyle, color: 'var(--k2-bad)' }}>{err}</div>
  }

  if (templates.length === 0) {
    return (
      <div style={emptyStateStyle}>
        Não há templates para este tipo. Cria um em <strong>Biblioteca → Templates</strong>{' '}
        ou usa &ldquo;Folha em branco com IA&rdquo;.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id === value ? null : t.id, t.conteudo)}
            style={{
              ...cardBtnStyle,
              borderColor: t.id === value ? 'var(--k2-accent)' : 'var(--k2-border)',
              background: t.id === value ? 'rgba(99,102,241,0.06)' : 'var(--k2-bg-elev)',
            }}
          >
            <FileText size={14} color="var(--k2-text-dim)" style={{ marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{t.nome}</span>
                <span style={{ fontSize: 10, color: 'var(--k2-text-mute)' }}>v{t.versao}</span>
              </div>
              {t.descricao && (
                <div style={{ fontSize: 11, color: 'var(--k2-text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                  {t.descricao}
                </div>
              )}
            </div>
            {t.id === value && <Check size={14} color="var(--k2-accent)" />}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ display: 'grid', gap: 8 }}>
          {placeholdersDetectados.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>
                Placeholders detectados ({placeholdersDetectados.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {placeholdersDetectados.map((path) => {
                  const filled = pathsPresentes?.has(path) ?? false
                  return (
                    <span
                      key={path}
                      title={
                        filled
                          ? 'Será preenchido com os dados deste formulário'
                          : 'Continuará como [A COMPLETAR — ...] no draft'
                      }
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--k2-font-mono, monospace)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: filled ? 'rgba(16,185,129,0.10)' : 'rgba(217,119,6,0.10)',
                        color: filled ? '#065f46' : '#92400e',
                        border: `1px solid ${
                          filled ? 'rgba(16,185,129,0.25)' : 'rgba(217,119,6,0.25)'
                        }`,
                      }}
                    >
                      {filled && '✓ '}
                      {path}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div style={sectionLabelStyle}>Preview</div>
            <pre style={previewStyle}>{selected.conteudo}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────

/**
 * Detecta `{{path | filter}}` no conteúdo do template. Devolve só o
 * `path` (sem o filter) para checar contra os caminhos preenchidos.
 */
function extractPlaceholders(content: string): string[] {
  const re = /\{\{\s*([^}|\s]+)\s*(?:\|[^}]+)?\s*\}\}/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    found.add(m[1].trim())
  }
  return [...found].sort()
}

// ─── Styles ──────────────────────────────────────────

const emptyStateStyle: React.CSSProperties = {
  padding: '20px 16px',
  textAlign: 'center',
  fontSize: 12,
  color: 'var(--k2-text-dim)',
  background: 'var(--k2-bg-elev)',
  border: '1px dashed var(--k2-border)',
  borderRadius: 'var(--k2-radius-sm)',
}

const cardBtnStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  padding: '10px 12px',
  border: '1px solid',
  borderRadius: 'var(--k2-radius-sm)',
  cursor: 'pointer',
  textAlign: 'left',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--k2-text-mute)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const previewStyle: React.CSSProperties = {
  background: 'var(--k2-bg-elev-2, var(--k2-bg-elev))',
  border: '1px solid var(--k2-border)',
  borderRadius: 'var(--k2-radius-sm)',
  padding: 12,
  fontSize: 11,
  lineHeight: 1.55,
  fontFamily: 'var(--k2-font-mono, monospace)',
  maxHeight: 260,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0,
  color: 'var(--k2-text)',
}
