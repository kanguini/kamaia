'use client'

/**
 * PdfPreview — visualizador de PDF inline numa coluna do contract
 * detail. Usa iframe nativo do navegador (suporta PDF directamente),
 * evitando o overhead do PDF.js no bundle.
 *
 * Comportamentos:
 *  - Carrega URL signed via /documents/:id quando há documentId
 *  - Mostra empty state quando o contrato ainda não tem documento
 *  - Botões: refresh URL (signed expira), abrir novo separador,
 *    download
 *  - Erro de carregamento → mensagem + retry
 *
 * Acessibilidade: iframe tem title; controlos têm aria-label.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'

interface DocumentRecord {
  id: string
  nome: string
  contentType: string | null
  storageKey: string
  url: string
}

interface VersaoLite {
  id: string
  versao: string
  direccao: string
  documentId: string | null
  documento?: { nome: string } | null
}

interface VersoesResponse {
  data: VersaoLite[]
}

export function PdfPreview({
  contratoId,
}: {
  contratoId: string
}) {
  const { data: session } = useSession()
  const [versoes, setVersoes] = useState<VersaoLite[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [docName, setDocName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Carrega versões + pré-selecciona a mais recente com documento
  useEffect(() => {
    if (!session?.accessToken) return
    let cancelled = false
    setLoading(true)
    api<VersoesResponse>(`/contratos/${contratoId}/versoes`, {
      token: session.accessToken,
    })
      .then((res) => {
        if (cancelled) return
        const list = res.data ?? []
        setVersoes(list)
        const withDoc = list.find((v) => v.documentId)
        if (withDoc?.documentId) {
          setActiveDocId(withDoc.documentId)
        } else {
          setLoading(false)
        }
      })
      .catch((e: { error?: string }) => {
        if (cancelled) return
        setErr(e?.error ?? 'Não foi possível carregar versões')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [contratoId, session?.accessToken])

  // Quando muda o documento activo, busca URL signed
  const refreshUrl = useCallback(async () => {
    if (!activeDocId || !session?.accessToken) {
      setDocUrl(null)
      setDocName(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const doc = await api<DocumentRecord>(`/documents/${activeDocId}`, {
        token: session.accessToken,
      })
      setDocUrl(doc.url)
      setDocName(doc.nome)
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Não foi possível abrir o documento')
    } finally {
      setLoading(false)
    }
  }, [activeDocId, session?.accessToken])

  useEffect(() => {
    void refreshUrl()
  }, [refreshUrl])

  const hasVersoesComDoc = versoes.some((v) => v.documentId)

  return (
    <div className="pdf-pv">
      {/* Header com versão picker + acções */}
      <div className="pdf-pv-head">
        <FileText size={14} className="pdf-pv-icon" />
        <div className="pdf-pv-title">
          {docName ? truncate(docName, 40) : 'Documento'}
        </div>
        {hasVersoesComDoc && versoes.length > 1 && (
          <select
            className="pdf-pv-versao"
            value={activeDocId ?? ''}
            onChange={(e) => setActiveDocId(e.target.value || null)}
            aria-label="Versão"
          >
            {versoes
              .filter((v) => v.documentId)
              .map((v) => (
                <option key={v.id} value={v.documentId ?? ''}>
                  {v.versao}
                </option>
              ))}
          </select>
        )}
        <div className="pdf-pv-actions">
          {docUrl && (
            <>
              <button
                type="button"
                onClick={() => void refreshUrl()}
                className="pdf-pv-btn"
                title="Renovar URL"
                aria-label="Renovar URL signed"
              >
                <RefreshCw size={11} />
              </button>
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="pdf-pv-btn"
                title="Abrir em separador novo"
                aria-label="Abrir em separador novo"
              >
                <ExternalLink size={11} />
              </a>
              <a
                href={docUrl}
                download={docName ?? 'documento.pdf'}
                className="pdf-pv-btn"
                title="Descarregar"
                aria-label="Descarregar"
              >
                <Download size={11} />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="pdf-pv-body">
        {loading && (
          <div className="pdf-pv-empty">
            <RefreshCw size={20} className="pdf-pv-spinner" />
            <span>A carregar…</span>
          </div>
        )}
        {!loading && err && (
          <div className="pdf-pv-empty error">
            <AlertCircle size={20} />
            <div>
              <div className="pdf-pv-empty-title">Erro a carregar PDF</div>
              <div className="pdf-pv-empty-sub">{err}</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshUrl()}
              className="pdf-pv-retry"
            >
              Tentar de novo
            </button>
          </div>
        )}
        {!loading && !err && !hasVersoesComDoc && (
          <div className="pdf-pv-empty">
            <FileText size={28} className="pdf-pv-empty-icon" />
            <div className="pdf-pv-empty-title">Sem documento</div>
            <div className="pdf-pv-empty-sub">
              Este contrato ainda não tem uma versão com ficheiro anexado.
              Anexa via aba Documentos.
            </div>
          </div>
        )}
        {!loading && !err && docUrl && (
          <iframe
            src={`${docUrl}#toolbar=0&navpanes=0`}
            className="pdf-pv-iframe"
            title={docName ?? 'Pré-visualização do documento'}
          />
        )}
      </div>

      <style jsx>{`
        .pdf-pv {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          overflow: hidden;
          min-height: 600px;
        }
        .pdf-pv-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--k2-border);
          background: var(--k2-bg-elev-2);
          flex-shrink: 0;
        }
        .pdf-pv-icon {
          color: var(--k2-text-mute);
          flex-shrink: 0;
        }
        .pdf-pv-title {
          flex: 1;
          font-size: 12px;
          font-weight: 500;
          color: var(--k2-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pdf-pv-versao {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          color: var(--k2-text);
          font-size: 11px;
          padding: 3px 6px;
          border-radius: var(--k2-radius-sm);
          font-family: inherit;
        }
        .pdf-pv-actions {
          display: inline-flex;
          gap: 2px;
        }
        .pdf-pv-btn {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          background: transparent;
          border: none;
          color: var(--k2-text-dim);
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          text-decoration: none;
          transition: background 120ms ease, color 120ms ease;
        }
        .pdf-pv-btn:hover {
          background: var(--k2-bg-hover);
          color: var(--k2-text);
        }
        .pdf-pv-body {
          flex: 1;
          display: flex;
          min-height: 0;
          position: relative;
        }
        .pdf-pv-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: var(--k2-bg);
        }
        .pdf-pv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 32px;
          color: var(--k2-text-mute);
          text-align: center;
        }
        .pdf-pv-empty.error {
          color: var(--k2-bad);
        }
        .pdf-pv-empty-icon {
          color: var(--k2-text-mute);
          margin-bottom: 4px;
        }
        .pdf-pv-empty-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--k2-text);
        }
        .pdf-pv-empty-sub {
          font-size: 11px;
          color: var(--k2-text-mute);
          max-width: 280px;
          line-height: 1.5;
        }
        .pdf-pv-retry {
          margin-top: 8px;
          padding: 6px 12px;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          color: var(--k2-text);
          font-size: 11px;
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
        }
        .pdf-pv-spinner {
          animation: pdf-spin 1.2s linear infinite;
          color: var(--k2-text-mute);
        }
        @keyframes pdf-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
