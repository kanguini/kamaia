'use client'

/**
 * Tab Documentos — lista de Document anexados ao contrato + upload avulso.
 *
 * Para anexos que não cabem nas tabs específicas:
 *  - Versões usa documentId nas linhas próprias
 *  - Compliance usa comprovativoId nos actos
 *  - Aqui ficam o resto: procurações, certidões, BIs, correspondência,
 *    actas, etc.
 *
 * Fluxo:
 *  - Dropzone no topo aceita PDF/Word/imagens (até 15 MB)
 *  - Upload via /documents com contratoId scope automático
 *  - Lista refresh local (optimistic insert)
 *  - Cada linha: ícone tipo, nome, mime, tamanho, uploadedBy, data,
 *    botão "Abrir" (signed URL) + soft delete
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileText, Download, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import {
  DocumentDropzone,
  type UploadedDocument,
} from '@/components/ui/document-dropzone'
import { fmtDateTime } from '@/lib/clm-format'
import { downloadById } from './versoes-tab'

interface DocItem {
  id: string
  nome: string
  mimeType: string
  tamanhoBytes: string | number | bigint
  uploadedBy: string | null
  createdAt: string
}

interface ListResponse {
  data: DocItem[]
  nextCursor: string | null
  total: number
}

export function DocumentosTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocs = async () => {
    if (status !== 'authenticated' || !session?.accessToken) return
    setLoading(true)
    try {
      const data = await api<ListResponse>(
        `/documents?contratoId=${contratoId}&limit=100`,
        { token: session.accessToken },
      )
      setItems(data.data ?? [])
      setError(null)
    } catch (e) {
      setError((e as { error?: string })?.error ?? 'Erro a carregar documentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, session?.accessToken, status])

  const onUploaded = (doc: UploadedDocument) => {
    // Optimistic insert no topo (mais recente primeiro)
    setItems((prev) => [
      {
        id: doc.id,
        nome: doc.nome,
        mimeType: doc.mimeType,
        tamanhoBytes: doc.tamanhoBytes,
        uploadedBy: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  const onDelete = async (id: string) => {
    if (!session?.accessToken) return
    if (!confirm('Mover este documento para a lixeira? Acção reversível pelo admin.')) return
    try {
      await api(`/documents/${id}`, {
        method: 'DELETE',
        token: session.accessToken,
      })
      setItems((prev) => prev.filter((d) => d.id !== id))
    } catch (e) {
      alert((e as { error?: string })?.error ?? 'Erro ao apagar')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>
        Anexa documentos avulsos do contrato (procurações, certidões,
        BIs, correspondência). Para versões da minuta usa o tab{' '}
        <strong>Versões</strong>; para comprovativos de actos
        regulatórios usa o tab <strong>Compliance</strong>.
      </div>

      <DocumentDropzone
        contratoId={contratoId}
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
        maxMB={15}
        onUploaded={onUploaded}
      />

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
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--k2-text-mute)', fontSize: 13 }}>
            Sem documentos avulsos. Larga um ficheiro acima para começar.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map((d) => (
              <li
                key={d.id}
                style={{
                  borderTop: '1px solid var(--k2-border)',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <FileText size={16} color="var(--k2-accent)" />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--k2-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.nome}
                  </span>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--k2-text-mute)' }}>
                    <Badge variant="default">{shortMime(d.mimeType)}</Badge>
                    <span>{formatBytes(Number(d.tamanhoBytes))}</span>
                    <span>· {fmtDateTime(d.createdAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <button
                    onClick={() => void downloadById(d.id)}
                    title="Abrir"
                    aria-label="Abrir documento"
                    style={iconBtnStyle}
                  >
                    <Download size={13} />
                  </button>
                  <button
                    onClick={() => void onDelete(d.id)}
                    title="Apagar"
                    aria-label="Apagar documento"
                    style={{ ...iconBtnStyle, color: 'var(--k2-bad)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--k2-border)',
  color: 'var(--k2-text-dim)',
  padding: '5px 8px',
  borderRadius: 'var(--k2-radius-sm)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 12,
}

function shortMime(mime: string): string {
  // application/pdf → PDF; image/png → PNG; application/vnd.openxmlformats-… → DOCX
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'application/msword') return 'DOC'
  if (
    mime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'DOCX'
  if (mime.startsWith('image/')) return mime.replace('image/', '').toUpperCase()
  return mime.split('/').pop()?.toUpperCase() ?? mime
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
