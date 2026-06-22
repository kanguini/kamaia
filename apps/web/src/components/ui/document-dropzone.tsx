'use client'

/**
 * DocumentDropzone — upload de ficheiro (PDF/imagem) por drag-and-drop
 * ou click-to-pick, via base64 POST para /documents.
 *
 * Devolve o doc criado (id + metadados) por callback — o caller decide
 * como o associar (e.g. comprovativoId em ContratoActoRegulatorio,
 * documentId em ContratoVersao).
 *
 * Limites:
 *  - Tamanho máximo 5MB por defeito (configurável)
 *  - MIME types restritos (PDF + imagens comuns); ajustável via prop
 *
 * Notas técnicas:
 *  - Lê o ficheiro com FileReader.readAsDataURL → strip do prefixo
 *    `data:...;base64,` → POST como contentBase64
 *  - Hash SHA-256 é calculado server-side (não precisamos repetir
 *    no cliente para o caso típico)
 *  - Suporta `contratoId` para scoping
 */

import { useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { UploadCloud, FileText, X, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export interface UploadedDocument {
  id: string
  nome: string
  mimeType: string
  tamanhoBytes: string | number | bigint
}

interface Props {
  /** Scope o upload a este contrato. */
  contratoId?: string
  /** Disparado quando upload conclui com sucesso. */
  onUploaded: (doc: UploadedDocument) => void
  /** Disparado quando o utilizador remove o anexo escolhido. */
  onCleared?: () => void
  /** MIME types aceites. Default: PDF + imagens comuns. */
  accept?: string
  /** Tamanho máximo em MB. Default: 5. */
  maxMB?: number
  /** Doc já anexado (controlled) — mostra preview compacto em vez de dropzone. */
  attached?: UploadedDocument | null
  disabled?: boolean
}

const DEFAULT_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'

export function DocumentDropzone({
  contratoId,
  onUploaded,
  onCleared,
  accept = DEFAULT_ACCEPT,
  maxMB = 5,
  attached,
  disabled,
}: Props) {
  const { data: session } = useSession()
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      setErr(null)
      if (!files || files.length === 0) return
      if (!session?.accessToken) {
        setErr('Sessão expirada — recarrega a página.')
        return
      }
      const file = files[0]
      if (file.size > maxMB * 1024 * 1024) {
        setErr(`Ficheiro maior que ${maxMB} MB.`)
        return
      }
      // Validação rudimentar de MIME (browser já filtrou pelo accept
      // do <input>, mas drag-and-drop pode trazer outros)
      const accepted = accept.split(',').map((s) => s.trim())
      if (accepted.length > 0 && !accepted.includes(file.type)) {
        setErr(`Tipo não suportado: ${file.type || 'desconhecido'}`)
        return
      }

      setBusy(true)
      try {
        const base64 = await fileToBase64(file)
        const doc = await api<UploadedDocument>('/documents', {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify({
            contratoId,
            nome: file.name,
            mimeType: file.type,
            tamanhoBytes: file.size,
            contentBase64: base64,
          }),
        })
        onUploaded(doc)
      } catch (e) {
        setErr(
          (e as { error?: string })?.error ??
            'Falha ao enviar — verifica a ligação e tenta de novo.',
        )
      } finally {
        setBusy(false)
      }
    },
    [accept, contratoId, maxMB, onUploaded, session?.accessToken],
  )

  if (attached) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border)',
          borderRadius: 'var(--k2-radius-sm)',
        }}
      >
        <FileText size={16} color="var(--k2-accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--k2-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {attached.nome}
          </div>
          <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
            {attached.mimeType} · {formatBytes(Number(attached.tamanhoBytes))}
          </div>
        </div>
        {!disabled && onCleared && (
          <button
            type="button"
            onClick={onCleared}
            title="Remover"
            aria-label="Remover anexo"
            style={{
              background: 'transparent',
              border: '1px solid var(--k2-border)',
              color: 'var(--k2-text-mute)',
              padding: '4px 6px',
              borderRadius: 'var(--k2-radius-sm)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (disabled) return
          e.preventDefault()
          setOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '20px 16px',
          background: over
            ? 'rgba(99,102,241,0.06)'
            : 'var(--k2-bg-elev)',
          border: `1px dashed ${
            over ? 'var(--k2-accent)' : 'var(--k2-border-strong, var(--k2-border))'
          }`,
          borderRadius: 'var(--k2-radius-sm)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        {busy ? (
          <Loader2 size={20} className="spin" color="var(--k2-text-dim)" />
        ) : (
          <UploadCloud size={20} color="var(--k2-text-dim)" />
        )}
        <div style={{ fontSize: 13, color: 'var(--k2-text)' }}>
          {busy
            ? 'A enviar…'
            : over
            ? 'Larga para enviar'
            : 'Arrasta um ficheiro ou clica para escolher'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
          PDF, PNG, JPEG, WebP · até {maxMB} MB
        </div>
        <input
          type="file"
          accept={accept}
          disabled={disabled || busy}
          onChange={(e) => void handleFiles(e.target.files)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      </label>
      {err && (
        <div style={{ fontSize: 11, color: 'var(--k2-bad)' }}>{err}</div>
      )}
      <style jsx>{`
        .spin {
          animation: spin 800ms linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('FileReader error'))
    fr.onload = () => {
      const result = String(fr.result || '')
      // Strip `data:<mime>;base64,` prefix → keep only o payload
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    fr.readAsDataURL(file)
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
