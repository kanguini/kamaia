'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { FileText, Image, File, Download, Upload, X, Loader2, Search } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { EmptyState, LoadingSkeleton, IconButton } from '@/components/ui'
import { DocumentCategory, PaginatedResponse } from '@kamaia/shared-types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface Document {
  id: string
  title: string
  filename: string
  category: DocumentCategory
  fileType: string
  fileSize: number
  uploadedAt: string
  uploadedBy: {
    firstName: string
    lastName: string
  }
  processo?: {
    id: string
    processoNumber: string
  }
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

function getFileIcon(fileType: string): React.ReactNode {
  const type = fileType.toLowerCase()
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

  const { data: processos } = useApi<PaginatedResponse<Processo>>('/processos?limit=1000')

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
      setError('Tipo de ficheiro nao suportado')
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
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [processoFilter, setProcessoFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const hasActiveFilters = search !== '' || categoryFilter !== 'ALL' || processoFilter !== 'ALL'

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('ALL')
    setProcessoFilter('ALL')
  }

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (categoryFilter !== 'ALL') params.append('category', categoryFilter)
    if (processoFilter !== 'ALL') params.append('processoId', processoFilter)
    if (search) params.append('search', search)
    return `/documents?${params.toString()}`
  }, [categoryFilter, processoFilter, search])

  const {
    data: documents,
    loading,
    error,
    refetch,
  } = useApi<PaginatedResponse<Document>>(endpoint, [categoryFilter, processoFilter, search])

  const { data: storage, refetch: refetchStorage } = useApi<StorageInfo>('/documents/storage')
  const { data: processos } = useApi<PaginatedResponse<Processo>>('/processos?limit=1000')

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

  const getStorageBarColor = (percentage: number) => {
    if (percentage < 50) return 'bg-success'
    if (percentage < 80) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-ink">Documentos</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium px-4 sm:px-6 py-2.5  hover:[background:var(--color-btn-primary-hover)] transition-colors min-h-[40px]"
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Enviar Documento</span>
          <span className="sm:hidden">Enviar</span>
        </button>
      </div>

      {/* Storage bar */}
      {storage && (
        <div className="bg-surface-raised p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-ink-muted">Armazenamento</p>
            <p className="text-sm font-mono text-ink">
              {formatFileSize(storage.used)} / {formatFileSize(storage.limit)} usados
            </p>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all', getStorageBarColor(storage.percentage))}
              style={{ width: `${Math.min(storage.percentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface-raised p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar documentos..."
              aria-label="Procurar documentos"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoria"
            className="px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent min-h-[40px]"
          >
            <option value="ALL">Todas as Categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={processoFilter}
            onChange={(e) => setProcessoFilter(e.target.value)}
            aria-label="Filtrar por processo"
            className="px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent min-h-[40px]"
          >
            <option value="ALL">Todos os Processos</option>
            {processos?.data.map((processo) => (
              <option key={processo.id} value={processo.id}>
                {processo.processoNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4" role="alert">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton count={5} label="A carregar documentos" />
      ) : !documents || documents.data.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Nenhum documento corresponde aos filtros aplicados"
            action={
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium  hover:[background:var(--color-btn-primary-hover)] transition-colors min-h-[40px]"
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Nenhum documento"
            description="Envie o seu primeiro ficheiro"
            action={
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium  hover:[background:var(--color-btn-primary-hover)] transition-colors min-h-[40px]"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Enviar Documento
              </button>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {documents.data.map((doc) => (
            <div
              key={doc.id}
              className="bg-surface border border-border p-4 hover:bg-surface-raised/80 transition-colors cursor-pointer"
              onClick={() => handleDownload(doc.id, doc.filename)}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">{getFileIcon(doc.fileType)}</div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-ink truncate">{doc.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-muted/10 text-ink-muted rounded-full border border-muted/20">
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                    {doc.processo && (
                      <Link
                        href={`/processos/${doc.processo.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-info hover:underline font-mono"
                      >
                        {doc.processo.processoNumber}
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {doc.uploadedBy.firstName} {doc.uploadedBy.lastName} • {formatDate(doc.uploadedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm text-ink-muted font-mono">{formatFileSize(doc.fileSize)}</span>
                  <IconButton
                    aria-label="Transferir documento"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(doc.id, doc.filename)
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <Download className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}

          {documents.nextCursor && (
            <div className="flex justify-center pt-4">
              <button className="px-6 py-2.5 border border-border  text-sm font-medium text-ink-muted hover:bg-surface-raised transition-colors">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}

      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} />
    </div>
  )
}
