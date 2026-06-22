'use client'

/**
 * Tab Versões — histórico de versões do contrato + importação de
 * minutas recebidas/enviadas.
 *
 * Substitui a versão read-only que vivia inline na detail-page. Razão
 * para esta tab existir como container separado do Editor: o editor
 * trabalha sobre a versão activa (markdown interno em drafting); aqui
 * cobrimos o fluxo de "circulação de documentos" — PDFs/Word que
 * chegam ou são enviados para fora do sistema, frequentes em
 * negociação real (Word redline, PDF assinado pela contraparte, etc.).
 *
 * Fluxo "Importar minuta":
 *  1. Owner recebe uma minuta nova da contraparte por email
 *  2. Clica "Importar minuta" → Drawer com:
 *     • Direcção (RECEBIDO_CONTRAPARTE / RECEBIDO_CLIENTE / etc.)
 *     • Label da versão (e.g. "v3.0-contraparte")
 *     • Comentário curto (opcional)
 *     • DocumentDropzone para o ficheiro (PDF/Word/imagem)
 *  3. Server cria Document + ContratoVersao linkada (via documentId)
 *  4. Lista actualiza com a nova linha + link para download
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Download, Sparkles, FileText, GitCompare } from 'lucide-react'
import { VersaoDireccao } from '@kamaia/shared-types'
import { api, apiUrl, getActiveTenantId } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import {
  DocumentDropzone,
  type UploadedDocument,
} from '@/components/ui/document-dropzone'
import { fmtDateTime } from '@/lib/clm-format'
import { DiffDrawer } from './diff-drawer'

interface Versao {
  id: string
  ordem: number
  versao: string
  direccao: VersaoDireccao
  comentario: string | null
  geradoPorIA: boolean
  corpoMarkdown: string | null
  documentId: string | null
  documento?: { id: string; nome: string; mimeType: string } | null
  createdAt: string
  criadoPor: string | null
}

const DIRECCAO_LABELS: Record<VersaoDireccao, string> = {
  [VersaoDireccao.INTERNA]: 'Interna',
  [VersaoDireccao.ENVIADO_CLIENTE]: 'Enviado ao cliente',
  [VersaoDireccao.RECEBIDO_CLIENTE]: 'Recebido do cliente',
  [VersaoDireccao.ENVIADO_CONTRAPARTE]: 'Enviado à contraparte',
  [VersaoDireccao.RECEBIDO_CONTRAPARTE]: 'Recebido da contraparte',
  [VersaoDireccao.ASSINADO_FINAL]: 'Assinado final',
}

function direccaoBadge(d: VersaoDireccao): 'default' | 'info' | 'warning' | 'success' {
  switch (d) {
    case VersaoDireccao.INTERNA: return 'default'
    case VersaoDireccao.ENVIADO_CLIENTE:
    case VersaoDireccao.ENVIADO_CONTRAPARTE: return 'info'
    case VersaoDireccao.RECEBIDO_CLIENTE:
    case VersaoDireccao.RECEBIDO_CONTRAPARTE: return 'warning'
    case VersaoDireccao.ASSINADO_FINAL: return 'success'
  }
}

export function VersoesTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<Versao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [diffVersaoId, setDiffVersaoId] = useState<string | null>(null)

  const fetchVersoes = async () => {
    if (status !== 'authenticated' || !session?.accessToken) return
    setLoading(true)
    try {
      const data = await api<Versao[]>(`/contratos/${contratoId}/versoes`, {
        token: session.accessToken,
      })
      setItems(data ?? [])
      setError(null)
    } catch (e) {
      setError((e as { error?: string })?.error ?? 'Erro a carregar versões')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchVersoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, session?.accessToken, status])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>
          {items.length} versão(ões) registada(s). Para editar o corpo de uma
          versão interna, usa o tab <strong>Editor</strong>.
        </div>
        <Button
          leftIcon={<Plus size={13} />}
          onClick={() => setImportOpen(true)}
        >
          Importar minuta
        </Button>
      </div>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div
        style={{
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border)',
          borderRadius: 'var(--k2-radius)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 24, color: 'var(--k2-text-mute)' }}>A carregar…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--k2-text-mute)', fontSize: 13 }}>
            Sem versões. Usa o Editor para criar a primeira ou “Importar
            minuta” para anexar um documento existente.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map((v) => (
              <VersaoRow
                key={v.id}
                versao={v}
                onDiff={
                  v.corpoMarkdown !== null
                    ? () => setDiffVersaoId(v.id)
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>

      <ImportarMinutaDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        contratoId={contratoId}
        proximaOrdem={items.length > 0 ? Math.max(...items.map((v) => v.ordem)) + 1 : 1}
        onDone={async () => {
          setImportOpen(false)
          await fetchVersoes()
        }}
      />

      <DiffDrawer
        open={diffVersaoId !== null}
        onClose={() => setDiffVersaoId(null)}
        contratoId={contratoId}
        versaoId={diffVersaoId}
        versaoLabel={items.find((v) => v.id === diffVersaoId)?.versao}
        outrasVersoes={items
          .filter((v) => v.id !== diffVersaoId && v.corpoMarkdown !== null)
          .map((v) => ({ id: v.id, ordem: v.ordem, versao: v.versao }))}
      />
    </div>
  )
}

// ─── Linha ────────────────────────────────────

function VersaoRow({
  versao,
  onDiff,
}: {
  versao: Versao
  onDiff?: () => void
}) {
  const downloadDoc = () => {
    if (!versao.documentId) return
    void downloadById(versao.documentId)
  }

  return (
    <li
      style={{
        borderTop: '1px solid var(--k2-border)',
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {versao.versao}
          </span>
          <Badge variant={direccaoBadge(versao.direccao)}>
            {DIRECCAO_LABELS[versao.direccao]}
          </Badge>
          {versao.geradoPorIA && (
            <Badge variant="info">
              <Sparkles size={9} style={{ marginRight: 3 }} /> IA
            </Badge>
          )}
          {versao.documento && (
            <Badge variant="default">
              <FileText size={9} style={{ marginRight: 3 }} /> com anexo
            </Badge>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--k2-text-mute)' }}>
          {fmtDateTime(versao.createdAt)} · ordem #{versao.ordem}
        </div>
        {versao.comentario && (
          <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 4 }}>
            {versao.comentario}
          </div>
        )}
        {versao.documento && (
          <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
            Anexo: {versao.documento.nome} ({versao.documento.mimeType})
          </div>
        )}
      </div>
      <div style={{ display: 'inline-flex', gap: 6 }}>
        {onDiff && (
          <Button
            variant="secondary"
            onClick={onDiff}
            leftIcon={<GitCompare size={12} />}
            title="Comparar com versão anterior"
          >
            Comparar
          </Button>
        )}
        {versao.documentId && (
          <Button
            variant="secondary"
            onClick={downloadDoc}
            leftIcon={<Download size={12} />}
          >
            Anexo
          </Button>
        )}
      </div>
    </li>
  )
}

// ─── Drawer Importar Minuta ────────────────

function ImportarMinutaDrawer({
  open,
  onClose,
  contratoId,
  proximaOrdem,
  onDone,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  proximaOrdem: number
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [direccao, setDireccao] = useState<VersaoDireccao>(
    VersaoDireccao.RECEBIDO_CONTRAPARTE,
  )
  const [versao, setVersao] = useState(`v${proximaOrdem}.0`)
  const [comentario, setComentario] = useState('')
  const [doc, setDoc] = useState<UploadedDocument | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDireccao(VersaoDireccao.RECEBIDO_CONTRAPARTE)
      setVersao(`v${proximaOrdem}.0`)
      setComentario('')
      setDoc(null)
      setErr(null)
    }
  }, [open, proximaOrdem])

  const submit = async () => {
    if (!session?.accessToken) return
    if (!doc) {
      setErr('Anexa o ficheiro da minuta antes de continuar.')
      return
    }
    if (!versao.trim()) {
      setErr('Indica a label da versão (ex.: v2.0-contraparte).')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      await api(`/contratos/${contratoId}/versoes`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          versao: versao.trim(),
          direccao,
          documentId: doc.id,
          comentario: comentario.trim() || undefined,
        }),
      })
      onDone()
    } catch (e) {
      setErr(
        (e as { error?: string })?.error ?? 'Erro ao registar versão importada.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={560}>
      <DrawerHeader
        title="Importar minuta"
        subtitle="Anexa um PDF/Word recebido (ou enviado) — cria uma nova versão no histórico do contrato com o documento linkado."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}

        <form
          id="importar-minuta-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <FieldLabel label="Direcção">
            <Select
              value={direccao}
              onChange={(e) => setDireccao(e.target.value as VersaoDireccao)}
            >
              {Object.values(VersaoDireccao).map((d) => (
                <option key={d} value={d}>{DIRECCAO_LABELS[d]}</option>
              ))}
            </Select>
            <small style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
              Tipicamente “Recebido da contraparte” para minutas que chegam
              por email.
            </small>
          </FieldLabel>

          <FieldLabel label="Etiqueta da versão" required>
            <Input
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder="Ex.: v2.0-contraparte"
              required
            />
          </FieldLabel>

          <FieldLabel label="Comentário (opcional)">
            <Textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ex.: Contraparte aceitou foro arbitral mas alterou cláusula 5.ª (preço)"
            />
          </FieldLabel>

          <FieldLabel label="Ficheiro" required>
            <DocumentDropzone
              contratoId={contratoId}
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              maxMB={15}
              attached={doc}
              onUploaded={(d) => setDoc(d)}
              onCleared={() => setDoc(null)}
            />
          </FieldLabel>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="importar-minuta-form" loading={submitting}>
          Registar versão
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
      <span>
        {label} {required && <span style={{ color: 'var(--k2-bad)' }}>*</span>}
      </span>
      {children}
    </label>
  )
}

// ─── Download helper ──────────────────────────────────

/**
 * Faz pedido autenticado ao GET /documents/:id (devolve {url, mimeType, nome}),
 * depois abre a signed URL numa nova aba para download. Versão isolada
 * porque o api() devolve JSON, não blob.
 */
export async function downloadById(docId: string) {
  const tenantId = getActiveTenantId()
  const sessionRes = await fetch('/api/auth/session')
  const session = (await sessionRes.json().catch(() => null)) as {
    accessToken?: string
  } | null
  if (!session?.accessToken) return
  const res = await fetch(apiUrl(`/documents/${docId}`), {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    },
  })
  if (!res.ok) return
  const data = (await res.json()) as { url: string }
  if (data.url) window.open(data.url, '_blank', 'noopener')
}
