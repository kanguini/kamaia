'use client'

/**
 * Kamaia CLM — Editor de corpo do contrato (markdown).
 *
 * Tab dedicada na detail-page do contrato. Escolhe a versão activa
 * (a mais recente sem assinaturas), permite editar `corpoMarkdown`
 * com preview live ao lado, e persiste via PATCH /versoes/:id/corpo.
 *
 * Decisões UX:
 *  - Split editor | preview por defeito (resoluções largas)
 *  - Fallback tabs em telas < 900px
 *  - Sem auto-save: explicit Save button + indicador "alterado" / "guardado"
 *  - Versão assinada → editor read-only com mensagem para criar nova versão
 *
 * Fluxo IA virá numa Fase B: botão "Redigir com IA" abre side panel,
 * insere conteúdo gerado num cursor selecionado. Para já, foco em
 * drafting manual sólido.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { renderMarkdownPreview } from '@/lib/markdown'
import { fmtDateTime } from '@/lib/clm-format'
import { VersaoDireccao } from '@kamaia/shared-types'
import { Save, FileText, Eye, Code2, Sparkles, BookmarkPlus, FileSearch } from 'lucide-react'
import { ComentariosPanel } from './comentarios-panel'
import { DraftIaDrawer, type DraftResult } from './draft-ia-drawer'
import { MarkdownToolbar, applyKeyboardShortcut } from './markdown-toolbar'
import { SaveClausulaDrawer } from './save-clausula-drawer'
import { PdfPreviewDrawer } from './pdf-preview-drawer'

interface VersaoFull {
  id: string
  ordem: number
  versao: string
  direccao: VersaoDireccao
  corpoMarkdown: string | null
  corpoHtml: string | null
  geradoPorIA: boolean
  criadoEm: string
  assinaturas?: Array<{ id: string; estado: string }>
}

type ViewMode = 'split' | 'editor' | 'preview'

export function EditorTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [versoes, setVersoes] = useState<VersaoFull[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [creating, setCreating] = useState(false)
  const [iaOpen, setIaOpen] = useState(false)
  const [saveClausulaOpen, setSaveClausulaOpen] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { mutate: createVersao, loading: creatingLoading, error: createErr } = useMutation<
    unknown,
    VersaoFull
  >(`/contratos/${contratoId}/versoes`, 'POST')

  // Initial load das versões — só uma vez por contrato.
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    api<VersaoFull[]>(`/contratos/${contratoId}/versoes`, {
      token: session.accessToken,
    })
      .then((data) => {
        if (cancelled) return
        setVersoes(data ?? [])
        const first = (data ?? []).find((v) => !hasAssinatura(v)) ?? data?.[0]
        if (first) {
          setSelectedId(first.id)
          setDraft(first.corpoMarkdown ?? '')
        }
      })
      .catch((err: { error?: string }) => {
        if (!cancelled) setLoadErr(err?.error ?? 'Erro a carregar versões')
      })
    return () => {
      cancelled = true
    }
  }, [contratoId, session?.accessToken, status])

  const selected = useMemo(
    () => versoes.find((v) => v.id === selectedId) ?? null,
    [versoes, selectedId],
  )
  const readOnly = selected ? hasAssinatura(selected) : false

  const onPickVersao = (id: string) => {
    if (dirty && !confirm('Tens alterações por guardar. Descartar?')) return
    setSelectedId(id)
    const v = versoes.find((x) => x.id === id)
    setDraft(v?.corpoMarkdown ?? '')
    setDirty(false)
    setSavedAt(null)
  }

  const onChangeDraft = (val: string) => {
    setDraft(val)
    setDirty(true)
  }

  const onSave = async () => {
    if (!selected || readOnly) return
    if (!session?.accessToken) return
    try {
      const updated = await api<VersaoFull>(
        `/contratos/${contratoId}/versoes/${selected.id}/corpo`,
        {
          method: 'PATCH',
          token: session.accessToken,
          body: JSON.stringify({ corpoMarkdown: draft }),
        },
      )
      setVersoes((prev) =>
        prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)),
      )
      setDirty(false)
      setSavedAt(new Date())
    } catch (e) {
      const err = e as { error?: string }
      alert(err?.error ?? 'Erro ao guardar')
    }
  }

  const onNovaVersao = async () => {
    setCreating(true)
    try {
      const baseOrdem = versoes.length > 0 ? Math.max(...versoes.map((v) => v.ordem)) + 1 : 1
      const result = await createVersao({
        versao: `v${baseOrdem}.0`,
        direccao: VersaoDireccao.INTERNA,
        corpoMarkdown: '',
      })
      if (result) {
        setVersoes((prev) => [result, ...prev])
        setSelectedId(result.id)
        setDraft('')
        setDirty(false)
        setSavedAt(null)
      }
    } finally {
      setCreating(false)
    }
  }

  const previewHtml = useMemo(() => renderMarkdownPreview(draft), [draft])

  // Empty state — sem versões, oferece criar a primeira.
  if (versoes.length === 0 && !loadErr) {
    return (
      <div
        style={{
          background: 'var(--k2-bg-elev)',
          border: '1px dashed var(--k2-border)',
          borderRadius: 'var(--k2-radius)',
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--k2-text-dim)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <FileText size={28} color="var(--k2-text-mute)" />
        <div style={{ fontSize: 14, color: 'var(--k2-text)' }}>
          Sem versões ainda.
        </div>
        <div style={{ fontSize: 12, maxWidth: 380 }}>
          Cria uma primeira versão para começar a redigir o contrato. Mais
          tarde podes pedir à IA para gerar uma minuta a partir do tipo de
          contrato e dos campos do resumo.
        </div>
        {createErr && (
          <div style={{ color: 'var(--k2-bad)', fontSize: 12 }}>{createErr}</div>
        )}
        <Button
          loading={creating || creatingLoading}
          onClick={onNovaVersao}
        >
          Criar primeira versão
        </Button>
      </div>
    )
  }

  if (loadErr) {
    return <div style={{ color: 'var(--k2-bad)' }}>{loadErr}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style jsx>{`
        .editor-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .editor-grid {
          display: grid;
          gap: 12px;
          align-items: stretch;
        }
        .editor-grid.split {
          grid-template-columns: 1fr 1fr;
        }
        .editor-grid.single {
          grid-template-columns: 1fr;
        }
        textarea.md-input {
          width: 100%;
          min-height: 540px;
          padding: 16px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          color: var(--k2-text);
          font-family: var(--k2-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
          font-size: 13px;
          line-height: 1.6;
          resize: vertical;
          outline: none;
        }
        textarea.md-input:focus {
          border-color: var(--k2-accent);
        }
        textarea.md-input[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .preview {
          padding: 18px 22px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          min-height: 540px;
          overflow: auto;
          font-size: 14px;
          line-height: 1.7;
          color: var(--k2-text);
        }
        .preview :global(h1),
        .preview :global(h2),
        .preview :global(h3),
        .preview :global(h4) {
          margin-top: 18px;
          margin-bottom: 8px;
          font-weight: 600;
          line-height: 1.3;
        }
        .preview :global(h1) {
          font-size: 22px;
        }
        .preview :global(h2) {
          font-size: 18px;
        }
        .preview :global(h3) {
          font-size: 15px;
        }
        .preview :global(p) {
          margin: 8px 0;
        }
        .preview :global(ul),
        .preview :global(ol) {
          padding-left: 22px;
          margin: 6px 0;
        }
        .preview :global(li) {
          margin: 3px 0;
        }
        .preview :global(code) {
          background: var(--k2-bg-elev-2);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.92em;
        }
        .preview :global(pre) {
          background: var(--k2-bg-elev-2);
          padding: 12px;
          border-radius: 6px;
          overflow: auto;
        }
        .preview :global(a) {
          color: var(--k2-accent);
        }
        @media (max-width: 900px) {
          .editor-grid.split {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="editor-toolbar">
        <Select
          value={selectedId ?? ''}
          onChange={(e) => onPickVersao(e.target.value)}
          style={{ maxWidth: 260 }}
        >
          {versoes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.versao} · {v.direccao.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>

        {readOnly && (
          <Badge variant="warning">Versão assinada — só leitura</Badge>
        )}
        {selected?.geradoPorIA && <Badge variant="info">Gerada por IA</Badge>}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'inline-flex',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            overflow: 'hidden',
          }}
        >
          <ViewBtn
            active={viewMode === 'editor'}
            onClick={() => setViewMode('editor')}
            label="Editor"
            icon={<Code2 size={12} />}
          />
          <ViewBtn
            active={viewMode === 'split'}
            onClick={() => setViewMode('split')}
            label="Split"
          />
          <ViewBtn
            active={viewMode === 'preview'}
            onClick={() => setViewMode('preview')}
            label="Preview"
            icon={<Eye size={12} />}
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            const ta = textareaRef.current
            if (!ta) return
            const sel = draft.slice(ta.selectionStart, ta.selectionEnd)
            if (!sel.trim()) {
              alert('Selecciona texto no editor para gravar como cláusula.')
              return
            }
            setSelectedText(sel)
            setSaveClausulaOpen(true)
          }}
          leftIcon={<BookmarkPlus size={13} />}
          title="Selecciona um trecho do editor e grava-o como cláusula reutilizável na biblioteca"
        >
          Salvar cláusula
        </Button>
        <Button
          variant="secondary"
          onClick={() => setIaOpen(true)}
          leftIcon={<Sparkles size={13} />}
          title="Pede ao Claude para redigir o corpo a partir dos dados do contrato"
        >
          Redigir com IA
        </Button>
        <Button
          variant="secondary"
          onClick={() => setPdfPreviewOpen(true)}
          leftIcon={<FileSearch size={13} />}
          title="Pré-visualiza o PDF completo do contrato (corpo + folha de assinaturas + compliance)"
        >
          Preview PDF
        </Button>
        <Button variant="secondary" onClick={onNovaVersao} loading={creating || creatingLoading}>
          Nova versão
        </Button>
        <Button
          onClick={onSave}
          disabled={!dirty || readOnly}
          leftIcon={<Save size={13} />}
        >
          Guardar
        </Button>
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--k2-text-mute)',
          display: 'flex',
          gap: 12,
        }}
      >
        {dirty ? (
          <span style={{ color: 'var(--k2-warn, #d4a017)' }}>● Alterações por guardar</span>
        ) : savedAt ? (
          <span>✓ Guardado às {fmtDateTime(savedAt.toISOString())}</span>
        ) : selected ? (
          <span>Criada em {fmtDateTime(selected.criadoEm)}</span>
        ) : null}
      </div>

      <div className={`editor-grid ${viewMode === 'split' ? 'split' : 'single'}`}>
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <MarkdownToolbar
              textareaRef={textareaRef}
              value={draft}
              onChange={onChangeDraft}
              disabled={readOnly}
            />
            <textarea
              ref={textareaRef}
              className="md-input"
              value={draft}
              onChange={(e) => onChangeDraft(e.target.value)}
              onKeyDown={(e) => {
                const ta = textareaRef.current
                if (!ta) return
                const consumed = applyKeyboardShortcut(e, ta, draft, onChangeDraft)
                if (consumed) e.preventDefault()
              }}
              disabled={readOnly}
              placeholder={
                readOnly
                  ? 'Versão já assinada. Cria uma nova versão para editar.'
                  : '# Cláusula 1.ª — Objecto\n\nEscreve o corpo do contrato em markdown.\n\n## 1.1.\n\nO presente contrato tem por objecto...'
              }
              spellCheck={false}
              style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className="preview"
            // O preview é gerado client-side só para feedback enquanto se
            // escreve; a fonte de verdade é o `corpoHtml` persistido pelo
            // server (que volta no payload do save).
            dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="color: var(--k2-text-mute)">Preview aparece aqui…</p>' }}
          />
        )}
      </div>

      <ComentariosPanel contratoId={contratoId} versaoId={selected?.id ?? null} />

      <SaveClausulaDrawer
        open={saveClausulaOpen}
        onClose={() => setSaveClausulaOpen(false)}
        textoSelecionado={selectedText}
        contratoId={contratoId}
      />

      <PdfPreviewDrawer
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        contratoId={contratoId}
      />

      <DraftIaDrawer
        open={iaOpen}
        onClose={() => setIaOpen(false)}
        contratoId={contratoId}
        versaoIdActiva={selected?.id ?? null}
        podeEditarVersao={!readOnly}
        onDrafted={(result: DraftResult) => {
          // Server já persistiu — sincronizamos estado local
          const novaVersao: VersaoFull = {
            id: result.versao.id,
            ordem: result.versao.ordem,
            versao: result.versao.versao,
            direccao: 'INTERNA' as VersaoDireccao,
            corpoMarkdown: result.versao.corpoMarkdown,
            corpoHtml: null,
            geradoPorIA: result.versao.geradoPorIA,
            criadoEm: new Date().toISOString(),
            assinaturas: [],
          }
          setVersoes((prev) => {
            if (result.criada) return [novaVersao, ...prev]
            return prev.map((v) => (v.id === novaVersao.id ? { ...v, ...novaVersao } : v))
          })
          setSelectedId(novaVersao.id)
          setDraft(result.versao.corpoMarkdown ?? '')
          setDirty(false)
          setSavedAt(new Date())
        }}
      />
    </div>
  )
}

function hasAssinatura(v: VersaoFull): boolean {
  return !!v.assinaturas?.some((a) => a.estado === 'ASSINADA')
}

function ViewBtn({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
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
