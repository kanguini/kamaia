'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  FileText, Image, File, Download, Upload, X, Loader2, Search, Filter,
  ChevronDown,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { DocumentCategory, PaginatedResponse } from '@kamaia/shared-types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface Document {
  id: string
  title: string
  // Backend uses mimeType (application/pdf etc.) — no separate "fileType" field.
  mimeType: string
  fileSize: number
  createdAt: string
  uploadedBy: {
    firstName: string
    lastName: string
  }
  processo?: {
    id: string
    processoNumber: string
    title?: string
  }
  category: DocumentCategory
}

interface Processo {
  id: string
  processoNumber: string
  title: string
}

interface StorageInfo {
  used: number
  limit: number
  percentage: number
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  [DocumentCategory.PETICAO]: 'Peticao',
  [DocumentCategory.CONTRATO]: 'Contrato',
  [DocumentCategory.PROCURACAO]: 'Procuracao',
  [DocumentCategory.SENTENCA]: 'Sentenca',
  [DocumentCategory.PARECER]: 'Parecer',
  [DocumentCategory.OUTRO]: 'Outro',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function getFileIcon(fileType: string | null | undefined): React.ReactNode {
  const type = (fileType ?? '').toLowerCase()
  if (type.includes('pdf')) {
    return <FileText className="w-5 h-5 text-danger" />
  }
  if (type.includes('word') || type.includes('doc')) {
    return <FileText className="w-5 h-5 text-info" />
  }
  if (type.includes('image') || type.includes('jpg') || type.includes('png')) {
    return <Image className="w-5 h-5 text-success" />
  }
  if (type.includes('excel') || type.includes('sheet')) {
    return <FileText className="w-5 h-5 text-success" />
  }
  return <File className="w-5 h-5 text-ink-muted" />
}

function UploadModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: session } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.OUTRO)
  const [processoId, setProcessoId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // limit=500 é o tecto aceite pelo backend; 1000 era rejeitado com 400.
  const { data: processos } = useApi<PaginatedResponse<Processo>>('/processos?limit=500')

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (selectedFile: File) => {
    setError(null)

    // Validate file size (50MB max)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('O ficheiro excede o tamanho maximo de 50 MB')
      return
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Tipo de ficheiro não suportado')
      return
    }

    setFile(selectedFile)
    // Auto-fill title with filename without extension
    const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
    setTitle(nameWithoutExt)
  }

  const handleUpload = async () => {
    if (!file || !session?.accessToken) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title || file.name)
      formData.append('category', category)
      if (processoId) formData.append('processoId', processoId)

      const res = await fetch(`${API_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro ao enviar ficheiro')
      }

      // Success
      onSuccess()
      handleClose()
    } catch (err: unknown) {
      const errorObj = err as Error
      setError(errorObj.message || 'Erro ao enviar ficheiro')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setTitle('')
    setCategory(DocumentCategory.OUTRO)
    setProcessoId('')
    setError(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface  max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Enviar Documento</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-surface-raised rounded transition-colors"
            >
              <X className="w-5 h-5 text-ink-muted" />
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-danger/10 border border-danger/20 text-danger  p-3 text-sm">
              {error}
            </div>
          )}

          {/* Drag and drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed p-8 mb-4 text-center transition-colors cursor-pointer',
              dragActive
                ? 'border-ink bg-surface-hover'
                : 'border-border-strong hover:border-ink',
            )}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
            />
            {file ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {getFileIcon(file.type)}
                  <span className="font-medium text-ink">{file.name}</span>
                </div>
                <p className="text-sm text-ink-muted">{formatFileSize(file.size)}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setTitle('')
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 text-ink-muted mx-auto" />
                <p className="text-ink font-medium">Arraste o ficheiro aqui ou clique para seleccionar</p>
                <p className="text-sm text-ink-muted">PDF, Word, Excel, Imagens (max 50 MB)</p>
              </div>
            )}
          </div>

          {/* Form fields */}
          {file && (
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-ink mb-1">
                  Titulo
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome do documento"
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-ink mb-1">
                  Categoria
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="processo" className="block text-sm font-medium text-ink mb-1">
                  Processo (opcional)
                </label>
                <select
                  id="processo"
                  value={processoId}
                  onChange={(e) => setProcessoId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                >
                  <option value="">Sem processo associado</option>
                  {processos?.data.map((processo) => (
                    <option key={processo.id} value={processo.id}>
                      {processo.processoNumber} — {processo.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium px-6 py-2.5 ',
                'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Enviar
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              disabled={uploading}
              className="px-6 py-2.5 border border-border  text-ink hover:bg-surface-raised transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DocumentosPage() {
  const { data: session } = useSession()
  const toast = useToast()
  const [showUpload, setShowUpload] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | null>(null)
  const [processoFilter, setProcessoFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryFilter, processoFilter])
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        document.getElementById('doc-search')?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (categoryFilter) params.append('category', categoryFilter)
    if (processoFilter) params.append('processoId', processoFilter)
    if (debouncedSearch) params.append('search', debouncedSearch)
    params.append('limit', '200')
    return `/documents?${params.toString()}`
  }, [categoryFilter, processoFilter, debouncedSearch])

  const {
    data: documents,
    loading,
    error,
    refetch,
  } = useApi<PaginatedResponse<Document>>(endpoint, [
    categoryFilter,
    processoFilter,
    debouncedSearch,
  ])
  const all = documents?.data ?? []
  const visible = useMemo(
    () => all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [all, page],
  )

  const { data: storage, refetch: refetchStorage } = useApi<StorageInfo>('/documents/storage')
  const { data: processosData } = useApi<PaginatedResponse<Processo>>('/processos?limit=500')
  const processos = processosData?.data ?? []

  const handleUploadSuccess = () => {
    toast.success('Documento enviado com sucesso')
    refetch()
    refetchStorage()
  }

  const handleDownload = async (docId: string, filename: string) => {
    if (!session?.accessToken) return
    try {
      const res = await fetch(`${API_URL}/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading file:', err)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="px-page">
      <style jsx global>{documentosStyles}</style>

      <div className="px-head">
        <div className="px-title">Documentos</div>
        <div className="px-head-actions">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="px-btn-primary"
          >
            <Upload size={14} /> Enviar documento
          </button>
        </div>
      </div>

      {storage && (
        <div className="px-storage">
          <div className="px-storage-head">
            <span>Armazenamento</span>
            <span className="mono">
              {formatFileSize(storage.used)} / {formatFileSize(storage.limit)}
            </span>
          </div>
          <div className="px-storage-bar">
            <div
              className={cn(
                'px-storage-fill',
                storage.percentage < 50
                  ? 'good'
                  : storage.percentage < 80
                    ? 'warn'
                    : 'bad',
              )}
              style={{ width: `${Math.min(storage.percentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="px-toolbar">
        <div className="px-search">
          <Search size={14} />
          <input
            id="doc-search"
            placeholder="Pesquisar por título... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="px-search-clear" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>
        <DocFilterChip
          label="Categoria"
          value={categoryFilter}
          options={Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
            id: id as DocumentCategory,
            label,
          }))}
          onChange={setCategoryFilter}
        />
        <DocFilterChip
          label="Processo"
          value={processoFilter}
          options={processos.map((p) => ({ id: p.id, label: p.processoNumber }))}
          onChange={setProcessoFilter}
        />
      </div>

      {error && <div className="px-error">{error}</div>}

      <div className="px-table-wrap">
        <div className="px-table">
          <div className="px-thead">
            <div>Ficheiro</div>
            <div>Categoria</div>
            <div>Processo</div>
            <div>Enviado por</div>
            <div style={{ textAlign: 'right' }}>Tamanho</div>
          </div>

          {loading && all.length === 0 ? (
            <div className="px-empty">A carregar documentos…</div>
          ) : all.length === 0 ? (
            <div className="px-empty">
              Sem documentos a mostrar.{' '}
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="px-linkish"
              >
                Enviar o primeiro
              </button>
              .
            </div>
          ) : (
            visible.map((doc) => (
              <div
                key={doc.id}
                className="px-row"
                role="button"
                tabIndex={0}
                onClick={() => handleDownload(doc.id, doc.title)}
              >
                <div className="px-cell-file">
                  <span className="px-file-icon">{getFileIcon(doc.mimeType)}</span>
                  <span className="name-text">{doc.title}</span>
                </div>
                <div className="px-meta">{CATEGORY_LABELS[doc.category]}</div>
                <div className="px-meta mono">
                  {doc.processo ? doc.processo.processoNumber : '—'}
                </div>
                <div className="px-meta">
                  <div>
                    {doc.uploadedBy?.firstName} {doc.uploadedBy?.lastName}
                  </div>
                  <div className="sub">{formatDate(doc.createdAt)}</div>
                </div>
                <div className="px-status" aria-label="Tamanho">
                  <span className="px-count-pill">{formatFileSize(doc.fileSize)}</span>
                  <button
                    type="button"
                    className="px-status-check"
                    title="Transferir"
                    aria-label="Transferir"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(doc.id, doc.title)
                    }}
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {all.length > PAGE_SIZE && (
        <div className="px-pagination">
          <span className="px-pagination-info">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, all.length)} de{' '}
            {all.length}
          </span>
          <div className="px-pagination-nav">
            <button
              type="button"
              className="px-pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              ‹
            </button>
            <span className="px-pagination-page">
              {page} / {Math.ceil(all.length / PAGE_SIZE)}
            </span>
            <button
              type="button"
              className="px-pagination-btn"
              onClick={() => setPage((p) => (p * PAGE_SIZE < all.length ? p + 1 : p))}
              disabled={page * PAGE_SIZE >= all.length}
              aria-label="Página seguinte"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}

// ── Inline filter chip (same shape as other lists) ──
function DocFilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: { id: T; label: string }[]
  onChange: (v: T | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = value != null
  const displayLabel = active
    ? options.find((o) => o.id === value)?.label ?? label
    : label

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`px-chip ${active ? 'on' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Filter size={13} />
        <span>{displayLabel}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="px-popover">
          <button
            type="button"
            className={`px-popover-item ${value == null ? 'on' : ''}`}
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            <span className="px-check">{value == null ? '●' : ''}</span>
            Todos
          </button>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`px-popover-item ${value === o.id ? 'on' : ''}`}
              onClick={() => {
                onChange(o.id)
                setOpen(false)
              }}
            >
              <span className="px-check">{value === o.id ? '●' : ''}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const documentosStyles = `
.px-page {
  margin: -1rem -1.5rem -1.5rem;
  padding: 24px clamp(20px, 3vw, 40px) 48px;
  color: var(--k2-text);
  background: var(--k2-bg);
  min-width: 0; max-width: 100%; overflow-x: clip;
}
.px-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.px-title { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.px-head-actions { display: flex; align-items: center; gap: 8px; }
.px-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 13px; font-weight: 500; background: var(--k2-accent); color: var(--k2-accent-fg); border: none; border-radius: var(--k2-radius-sm); cursor: pointer; transition: filter 120ms; }
.px-btn-primary:hover { filter: brightness(1.08); }

.px-storage {
  padding: 12px 16px; border: 1px solid var(--k2-border);
  border-radius: var(--k2-radius); background: var(--k2-bg);
  margin-bottom: 16px;
}
.px-storage-head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: var(--k2-text-dim); margin-bottom: 8px;
}
.px-storage-head .mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--k2-text);
}
.px-storage-bar { height: 4px; background: var(--k2-bg-hover); border-radius: 2px; overflow: hidden; }
.px-storage-fill { height: 100%; transition: width 200ms; }
.px-storage-fill.good { background: var(--k2-good); }
.px-storage-fill.warn { background: var(--k2-warn); }
.px-storage-fill.bad  { background: var(--k2-bad); }

.px-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.px-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); color: var(--k2-text-mute); }
.px-search input { flex: 1; background: transparent; border: none; outline: none; color: var(--k2-text); font-size: 13px; font-family: inherit; }
.px-search input::placeholder { color: var(--k2-text-mute); }
.px-search-clear { background: transparent; border: none; color: var(--k2-text-mute); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }

.px-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 12px; font-weight: 500; background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text-dim); cursor: pointer; transition: all 120ms; }
.px-chip:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-chip.on { color: var(--k2-text); border-color: var(--k2-accent); background: color-mix(in oklch, var(--k2-accent) 10%, var(--k2-bg)); }

.px-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 200px; max-height: 320px; overflow-y: auto; padding: 6px; background: var(--k2-bg); border: 1px solid var(--k2-border-strong); border-radius: var(--k2-radius); box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5); }
.px-popover-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 10px; font-size: 13px; color: var(--k2-text-dim); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left; }
.px-popover-item:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
.px-popover-item.on { color: var(--k2-text); }
.px-check { width: 14px; display: inline-grid; place-items: center; font-size: 10px; color: var(--k2-accent); line-height: 1; }

.px-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid var(--k2-border); border-radius: var(--k2-radius-lg); background: var(--k2-bg); }
.px-table { min-width: 780px; }
.px-thead, .px-row {
  display: grid;
  grid-template-columns: 2.6fr 1fr 0.9fr 1.6fr 150px;
  gap: 16px; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid var(--k2-border);
}
.px-thead { background: transparent; font-size: 10px; color: var(--k2-text-mute); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.px-row { cursor: pointer; transition: background 120ms; }
.px-row:hover { background: var(--k2-bg-hover); }
.px-row:last-child { border-bottom: none; }

.px-cell-file { display: flex; align-items: center; gap: 10px; min-width: 0; }
.px-cell-file .name-text {
  font-size: 14px; font-weight: 500; color: var(--k2-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.px-file-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; flex-shrink: 0;
  background: var(--k2-bg-hover); border-radius: 6px;
}
.px-meta { font-size: 12px; color: var(--k2-text-dim); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-meta.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.px-meta .sub { font-size: 11px; color: var(--k2-text-mute); }

.px-status { display: flex; align-items: center; justify-content: flex-end; gap: 8px; position: relative; }
.px-count-pill {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 10px; font-size: 11px; font-weight: 500;
  background: var(--k2-bg-hover); color: var(--k2-text);
  border-radius: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.px-status-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  background: transparent; border: 1px solid var(--k2-border);
  border-radius: 6px; color: var(--k2-text-dim); cursor: pointer;
  opacity: 0; transition: opacity 120ms, color 120ms, border-color 120ms;
}
.px-row:hover .px-status-check,
.px-row:focus-visible .px-status-check {
  opacity: 1;
}
.px-status-check:hover { color: var(--k2-text); border-color: var(--k2-border-strong); }

.px-empty { padding: 40px 20px; text-align: center; color: var(--k2-text-mute); font-size: 13px; }
.px-linkish { background: transparent; border: none; color: var(--k2-accent); cursor: pointer; font: inherit; padding: 0; }
.px-linkish:hover { text-decoration: underline; }

.px-error {
  padding: 12px 16px;
  background: color-mix(in oklch, var(--k2-bad) 10%, transparent);
  border: 1px solid color-mix(in oklch, var(--k2-bad) 30%, var(--k2-border));
  border-radius: var(--k2-radius); color: var(--k2-bad); font-size: 13px;
  margin-bottom: 16px;
}

.px-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 4px 0; font-size: 12px; color: var(--k2-text-dim); }
.px-pagination-info { font-variant-numeric: tabular-nums; }
.px-pagination-nav { display: inline-flex; align-items: center; gap: 8px; }
.px-pagination-page { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; color: var(--k2-text); }
.px-pagination-btn { width: 28px; height: 28px; display: inline-grid; place-items: center; background: transparent; border: 1px solid var(--k2-border); border-radius: 6px; color: var(--k2-text-dim); cursor: pointer; font-size: 14px; transition: all 120ms; }
.px-pagination-btn:hover:not(:disabled) { color: var(--k2-text); border-color: var(--k2-border-strong); }
.px-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 900px) {
  .px-page { padding: 16px 20px; }
  .px-thead { display: none; }
  .px-row { grid-template-columns: 1fr; gap: 6px; padding: 14px 16px; }
}
`
