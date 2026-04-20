'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  Trash2,
  ArrowRight,
  MessageSquare,
  FileText,
  Scale,
  RefreshCw,
  Loader2,
  Clock,
  Plus,
  CheckCircle,
  Bot,
  Upload,
  Download,
  File,
  Image as ImageIcon,
  Gavel,
} from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  ProcessoType,
  ProcessoStatus,
  ProcessoPriority,
  ProcessoEventType,
  PROCESSO_STAGES,
  PrazoStatus,
  TramitacaoAutor,
  TRAMITACAO_AUTOR_LABELS,
  TRAMITACAO_ACTO_TYPES,
  type PaginatedResponse,
} from '@kamaia/shared-types'
import { useSession } from 'next-auth/react'
import { PipelineBar } from '@/components/ui/pipeline-bar'
import { api } from '@/lib/api'
import { TramitacaoFormModal } from '@/components/forms/tramitacao-form-modal'

interface ProcessoEvent {
  id: string
  type: ProcessoEventType
  description: string
  createdAt: string
  user: {
    firstName: string
    lastName: string
  }
}

interface Prazo {
  id: string
  title: string
  dueDate: string
  status: PrazoStatus
}

interface Document {
  id: string
  title: string
  filename: string
  fileType: string
  fileSize: number
}

interface Tramitacao {
  id: string
  autor: TramitacaoAutor
  actoType: string
  title: string
  description: string | null
  actoDate: string
  advancedToStage: string | null
  generatedPrazo: {
    id: string
    title: string
    dueDate: string
    status: PrazoStatus
  } | null
  createdAt: string
  user: {
    firstName: string
    lastName: string
  }
}

interface Rentabilidade {
  totalHoras: number
  totalBillable: number
  valorHoras: number
  totalDespesas: number
  receitaEstimada: number
  custoTotal: number
  margemLucro: number
}

interface Processo {
  id: string
  processoNumber: string
  title: string
  description: string | null
  type: ProcessoType
  status: ProcessoStatus
  priority: ProcessoPriority
  currentStage: string
  lifecycle: string | null
  tags: string[]
  court: string | null
  courtCaseNumber: string | null
  judge: string | null
  opposingParty: string | null
  opposingLawyer: string | null
  feeType: string | null
  feeAmount: number | null
  createdAt: string
  cliente: {
    id: string
    name: string
    nif: string | null
  }
  advogado: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  events: ProcessoEvent[]
  prazos: Prazo[]
  documents?: Document[]
}

const PROCESSO_TYPE_LABELS: Record<ProcessoType, string> = {
  [ProcessoType.CIVEL]: 'Civel',
  [ProcessoType.LABORAL]: 'Laboral',
  [ProcessoType.COMERCIAL]: 'Comercial',
  [ProcessoType.CRIMINAL]: 'Criminal',
  [ProcessoType.ADMINISTRATIVO]: 'Administrativo',
  [ProcessoType.FAMILIA]: 'Familia',
  [ProcessoType.ARBITRAGEM]: 'Arbitragem',
}

const EVENT_ICONS: Record<ProcessoEventType, React.ElementType> = {
  [ProcessoEventType.STAGE_CHANGE]: ArrowRight,
  [ProcessoEventType.NOTE]: MessageSquare,
  [ProcessoEventType.DOCUMENT_ADDED]: FileText,
  [ProcessoEventType.HEARING]: Scale,
  [ProcessoEventType.DEADLINE_SET]: Clock,
  [ProcessoEventType.STATUS_CHANGE]: RefreshCw,
}

function ProcessoSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 bg-surface-raised rounded w-1/3" />
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-raised p-6 h-32" />
        <div className="bg-surface-raised p-6 h-32" />
      </div>
    </div>
  )
}

export default function ProcessoDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: session } = useSession()
  const [noteText, setNoteText] = useState('')
  const [tramitacaoOpen, setTramitacaoOpen] = useState(false)

  const { data: processo, loading, error, refetch } = useApi<Processo>(`/processos/${id}`)
  const {
    data: tramitacoesData,
    refetch: refetchTramitacoes,
  } = useApi<PaginatedResponse<Tramitacao>>(`/tramitacoes?processoId=${id}&limit=50`)
  const { data: rentabilidade } = useApi<Rentabilidade>(`/stats/rentabilidade?processoId=${id}`)
  const { mutate: deleteProcesso, loading: deleting } = useMutation(`/processos/${id}`, 'DELETE')
  const { mutate: advanceStage, loading: advancing } = useMutation(
    `/processos/${id}/stage`,
    'PATCH',
  )
  const { mutate: addNote, loading: addingNote } = useMutation<{ description: string }>(
    `/processos/${id}/events`,
    'POST',
  )
  const { mutate: completePrazo } = useMutation('/prazos/ID/complete', 'PATCH')

  const toast = useToast()

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja eliminar este processo?')) return
    const result = await deleteProcesso()
    if (result !== null) {
      toast.success('Processo eliminado')
      router.push('/processos')
    } else {
      toast.error('Erro ao eliminar processo')
    }
  }

  const handleAdvanceStage = async () => {
    if (!processo) return
    const stages = PROCESSO_STAGES[processo.type]
    const currentIndex = stages.indexOf(processo.currentStage)
    if (currentIndex === -1 || currentIndex >= stages.length - 1) return

    const result = await advanceStage({ stage: stages[currentIndex + 1] })
    if (result) {
      toast.success('Fase avancada')
      refetch()
    }
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    const result = await addNote({ description: noteText })
    if (result) {
      setNoteText('')
      refetch()
    }
  }

  const handleCompletePrazo = async () => {
    const result = await completePrazo(undefined)
    if (result !== null) {
      refetch()
    }
  }

  const getStatusBadge = (status: ProcessoStatus) => {
    const styles = {
      [ProcessoStatus.ACTIVO]: 'bg-success/10 text-success border-success/20',
      [ProcessoStatus.SUSPENSO]: 'bg-warning/10 text-warning border-warning/20',
      [ProcessoStatus.ENCERRADO]: 'bg-muted/10 text-ink-muted border-muted/20',
      [ProcessoStatus.ARQUIVADO]: 'bg-ink/10 text-ink border-ink/20',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
          styles[status],
        )}
      >
        {status}
      </span>
    )
  }

  const getPriorityBadge = (priority: ProcessoPriority) => {
    const styles = {
      [ProcessoPriority.ALTA]: 'bg-danger/10 text-danger border-danger/20',
      [ProcessoPriority.MEDIA]: 'bg-warning/10 text-warning border-warning/20',
      [ProcessoPriority.BAIXA]: 'bg-muted/10 text-ink-muted border-muted/20',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
          styles[priority],
        )}
      >
        {priority}
      </span>
    )
  }

  const getPrazoStatusBadge = (status: PrazoStatus) => {
    const styles = {
      [PrazoStatus.PENDENTE]: 'bg-warning/10 text-warning border-warning/20',
      [PrazoStatus.CUMPRIDO]: 'bg-success/10 text-success border-success/20',
      [PrazoStatus.EXPIRADO]: 'bg-danger/10 text-danger border-danger/20',
      [PrazoStatus.CANCELADO]: 'bg-muted/10 text-ink-muted border-muted/20',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-full border',
          styles[status],
        )}
      >
        {status}
      </span>
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatRelativeTime = (date: string) => {
    const now = new Date()
    const past = new Date(date)
    const diff = now.getTime() - past.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (hours < 24) return `ha ${hours}h`
    if (days < 7) return `ha ${days}d`
    return formatDate(date)
  }

  const formatMoney = (amount: number) => {
    return `${amount.toLocaleString('pt-AO')} AOA`
  }

  const formatMoneyCentavos = (centavos: number): string => {
    return `${(centavos / 100).toLocaleString('pt-AO')} AOA`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const getFileIcon = (fileType: string): React.ReactNode => {
    const type = fileType.toLowerCase()
    if (type.includes('pdf')) {
      return <FileText className="w-4 h-4 text-danger" />
    }
    if (type.includes('word') || type.includes('doc')) {
      return <FileText className="w-4 h-4 text-info" />
    }
    if (type.includes('image') || type.includes('jpg') || type.includes('png')) {
      return <ImageIcon className="w-4 h-4 text-success" />
    }
    if (type.includes('excel') || type.includes('sheet')) {
      return <FileText className="w-4 h-4 text-success" />
    }
    return <File className="w-4 h-4 text-ink-muted" />
  }

  const handleDownload = async (docId: string, filename: string) => {
    if (!session?.accessToken) return
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
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

  if (loading) return <ProcessoSkeleton />

  if (error || !processo) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4">
          {error || 'Processo não encontrado'}
        </div>
      </div>
    )
  }

  const stages = PROCESSO_STAGES[processo.type]
  const currentStageIndex = stages.indexOf(processo.currentStage)
  const isLastStage = currentStageIndex === stages.length - 1
  const isSocio = session?.role === 'SOCIO_GESTOR'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/processos"
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-sm font-mono text-ink-muted mb-1">{processo.processoNumber}</p>
          <h1 className="font-display text-4xl font-semibold text-ink mb-3">{processo.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 bg-info/10 text-info rounded-full border border-info/20">
              {PROCESSO_TYPE_LABELS[processo.type]}
            </span>
            {getStatusBadge(processo.status)}
            {getPriorityBadge(processo.priority)}
          </div>

          {/* Pipeline 8 fases */}
          <div className="mt-4">
            <PipelineBar
              currentStage={processo.lifecycle || 'ATENDIMENTO'}
              onAdvance={async (stage) => {
                if (!session?.accessToken) return
                try {
                  await api(`/processos/${id}/lifecycle`, {
                    method: 'PATCH',
                    body: JSON.stringify({ lifecycle: stage }),
                    token: session.accessToken,
                  })
                  toast.success(`Ciclo avancado para "${stage}"`)
                  refetch()
                } catch {
                  toast.error('Erro ao avancar ciclo')
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/ia-assistente?processoId=${processo.id}&context=PROCESSO`}
            className="flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]  text-sm font-medium hover:[background:var(--color-btn-primary-hover)] transition-colors"
          >
            <Bot className="w-4 h-4" />
            Consultar IA
          </Link>
          <Link
            href={`/processos/${id}/editar`}
            className="flex items-center gap-2 px-4 py-2 border border-border  text-sm font-medium text-ink hover:bg-surface-raised transition-colors"
          >
            <Edit className="w-4 h-4" />
            Editar
          </Link>
          {isSocio && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 border border-danger/20 bg-danger/10 text-danger  text-sm font-medium hover:bg-danger/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {processo.description && (
        <div className="bg-surface-raised p-6">
          <p className="text-ink">{processo.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-raised p-5">
          <p className="text-xs font-mono text-ink-muted uppercase mb-2">Cliente</p>
          <Link href={`/clientes/${processo.cliente.id}`} className="hover:underline">
            <p className="font-medium text-ink">{processo.cliente.name}</p>
            {processo.cliente.nif && (
              <p className="text-sm text-ink-muted font-mono">{processo.cliente.nif}</p>
            )}
          </Link>
        </div>

        <div className="bg-surface-raised p-5">
          <p className="text-xs font-mono text-ink-muted uppercase mb-2">Tribunal</p>
          <p className="font-medium text-ink">{processo.court || '—'}</p>
          {processo.courtCaseNumber && (
            <p className="text-sm text-ink-muted font-mono">{processo.courtCaseNumber}</p>
          )}
          {processo.judge && <p className="text-sm text-ink-muted">{processo.judge}</p>}
        </div>

        <div className="bg-surface-raised p-5">
          <p className="text-xs font-mono text-ink-muted uppercase mb-2">Advogado</p>
          <p className="font-medium text-ink">
            {processo.advogado.firstName} {processo.advogado.lastName}
          </p>
          <p className="text-sm text-ink-muted">{processo.advogado.email}</p>
        </div>

        <div className="bg-surface-raised p-5">
          <p className="text-xs font-mono text-ink-muted uppercase mb-2">Honorarios</p>
          <p className="font-medium text-ink">{processo.feeType || '—'}</p>
          {processo.feeAmount && (
            <p className="text-sm text-ink-muted">{formatMoney(processo.feeAmount)}</p>
          )}
        </div>
      </div>

      <div className="bg-surface-raised p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold text-ink">Evolucao do Processo</h2>
          <button
            onClick={handleAdvanceStage}
            disabled={advancing || isLastStage}
            className={cn(
              'flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]  text-sm font-medium',
              'hover:[background:var(--color-btn-primary-hover)] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {advancing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Avancar Estagio
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex items-center gap-2 min-w-max">
            {stages.map((stage, index) => (
              <div key={stage} className="flex items-center">
                <div
                  className={cn(
                    'px-4 py-2  text-sm font-mono whitespace-nowrap transition-colors',
                    index === currentStageIndex
                      ? '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium'
                      : index < currentStageIndex
                        ? 'bg-success/20 text-success'
                        : 'bg-border text-ink-muted',
                  )}
                >
                  {stage}
                </div>
                {index < stages.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 mx-1',
                      index < currentStageIndex ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tramitação — actos processuais registados pelo advogado. */}
      <TramitacaoTimeline
        tramitacoes={tramitacoesData?.data || []}
        onRegister={() => setTramitacaoOpen(true)}
      />

      <TramitacaoFormModal
        open={tramitacaoOpen}
        onClose={() => setTramitacaoOpen(false)}
        onSuccess={() => {
          refetchTramitacoes()
          refetch()
        }}
        processoId={id}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-raised p-6">
            <h2 className="font-display text-2xl font-semibold text-ink mb-4">
              Historico do Processo
            </h2>

            <div className="mb-6">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Adicionar nota ao processo..."
                rows={3}
                className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none mb-3"
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]  text-sm font-medium',
                  'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {addingNote ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Adicionar Nota
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {processo.events.length === 0 ? (
                <p className="text-center text-ink-muted py-8">Nenhum evento registado</p>
              ) : (
                processo.events.map((event) => {
                  const Icon = EVENT_ICONS[event.type]
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="p-2 bg-amber/10  h-fit">
                        <Icon className="w-4 h-4 text-ink" />
                      </div>
                      <div className="flex-1">
                        <p className="text-ink">{event.description}</p>
                        <p className="text-xs text-ink-muted mt-1">
                          {event.user.firstName} {event.user.lastName} •{' '}
                          {formatRelativeTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-raised p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl font-semibold text-ink">Prazos</h2>
              <Link
                href={`/prazos/novo?processoId=${processo.id}`}
                className="text-sm text-ink-muted hover:text-ink-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Novo Prazo
              </Link>
            </div>

            {processo.prazos.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                <p className="text-ink-muted text-sm">Nenhum prazo associado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processo.prazos.map((prazo) => {
                  const dueDate = new Date(prazo.dueDate)
                  const isOverdue = dueDate < new Date() && prazo.status === PrazoStatus.PENDENTE

                  return (
                    <Link
                      key={prazo.id}
                      href={`/prazos/${prazo.id}`}
                      className={cn(
                        'block bg-surface  p-3 hover:bg-surface-raised transition-colors',
                        isOverdue && 'border-l-4 border-danger',
                      )}
                    >
                      <p className="font-medium text-ink text-sm mb-1">{prazo.title}</p>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-ink-muted font-mono">{formatDate(prazo.dueDate)}</p>
                        {getPrazoStatusBadge(prazo.status)}
                      </div>
                      {prazo.status === PrazoStatus.PENDENTE && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleCompletePrazo()
                          }}
                          className="flex items-center gap-1 text-xs text-success hover:opacity-80 transition-opacity"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Cumprido
                        </button>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-ink">Documentos</h2>
          <Link
            href={`/documentos?processoId=${processo.id}`}
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink-600"
          >
            <Upload className="w-4 h-4" />
            Enviar Documento
          </Link>
        </div>
        {processo.documents && processo.documents.length > 0 ? (
          <div className="space-y-2">
            {processo.documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => handleDownload(doc.id, doc.filename)}
                className="bg-surface border border-border p-3 hover:bg-surface-raised/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">{getFileIcon(doc.fileType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink text-sm truncate">{doc.title}</p>
                    <p className="text-xs text-ink-muted font-mono">{formatFileSize(doc.fileSize)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(doc.id, doc.filename)
                    }}
                    className="p-1.5 hover:bg-border rounded transition-colors flex-shrink-0"
                  >
                    <Download className="w-4 h-4 text-ink-muted" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface border border-border p-6 text-center">
            <FileText className="w-8 h-8 text-ink-muted mx-auto mb-2" />
            <p className="text-ink-muted text-sm">Nenhum documento associado</p>
          </div>
        )}
      </div>

      {/* Rentabilidade Section */}
      {rentabilidade && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-ink">Rentabilidade</h2>
            <Link
              href={`/timesheets?processoId=${processo.id}`}
              className="text-sm text-ink-muted hover:text-ink-600 font-medium"
            >
              Ver timesheets
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-raised p-5">
              <p className="text-xs font-mono text-ink-muted uppercase mb-2">Horas registadas</p>
              <p className="text-2xl font-semibold text-ink">
                {rentabilidade.totalHoras}h
              </p>
            </div>
            <div className="bg-surface-raised p-5">
              <p className="text-xs font-mono text-ink-muted uppercase mb-2">Valor estimado</p>
              <p className="text-2xl font-semibold text-ink">
                {formatMoneyCentavos(rentabilidade.valorHoras)}
              </p>
            </div>
            <div className="bg-surface-raised p-5">
              <p className="text-xs font-mono text-ink-muted uppercase mb-2">Despesas</p>
              <p className="text-2xl font-semibold text-ink">
                {formatMoneyCentavos(rentabilidade.totalDespesas)}
              </p>
            </div>
          </div>
          {processo.feeType === 'HORA' && rentabilidade.valorHoras > 0 && (
            <div className="mt-4 bg-surface-raised p-5">
              <p className="text-xs font-mono text-ink-muted uppercase mb-2">Margem</p>
              <p className="text-2xl font-semibold text-ink">{rentabilidade.margemLucro}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tramitação Timeline ──────────────────────────────────────
// Actos processuais registados pelo advogado (≠ ProcessoEvent, que é audit
// trail do sistema). Cada item mostra autor, tipo, data e automações
// disparadas (Prazo gerado, fase avançada).

function TramitacaoTimeline({
  tramitacoes,
  onRegister,
}: {
  tramitacoes: Tramitacao[]
  onRegister: () => void
}) {
  const getActoLabel = (key: string) =>
    TRAMITACAO_ACTO_TYPES.find((a) => a.key === key)?.label ?? key

  const getAutorStyle = (autor: TramitacaoAutor) => {
    const map: Record<TramitacaoAutor, string> = {
      [TramitacaoAutor.NOS]: 'bg-info/10 text-info border-info/20',
      [TramitacaoAutor.TRIBUNAL]: 'bg-ink/10 text-ink border-ink/20',
      [TramitacaoAutor.CONTRAPARTE]: 'bg-warning/10 text-warning border-warning/20',
      [TramitacaoAutor.MINISTERIO_PUBLICO]: 'bg-danger/10 text-danger border-danger/20',
      [TramitacaoAutor.OUTRO]: 'bg-muted/10 text-ink-muted border-muted/20',
    }
    return map[autor]
  }

  const formatActoDate = (date: string) =>
    new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  return (
    <div className="bg-surface-raised p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gavel className="w-5 h-5 text-ink" />
          <h2 className="font-display text-2xl font-semibold text-ink">Tramitação</h2>
          <span className="text-xs font-mono text-ink-muted">
            ({tramitacoes.length} {tramitacoes.length === 1 ? 'acto' : 'actos'})
          </span>
        </div>
        <button
          onClick={onRegister}
          className="flex items-center gap-2 px-4 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] text-sm font-medium hover:[background:var(--color-btn-primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registar Acto
        </button>
      </div>

      {tramitacoes.length === 0 ? (
        <div className="text-center py-10">
          <Gavel className="w-10 h-10 text-ink-muted mx-auto mb-3" />
          <p className="text-ink-muted text-sm mb-1">
            Nenhum acto processual registado ainda.
          </p>
          <p className="text-xs text-ink-muted">
            Comece com um template (≈10s) — citação, contestação, sentença…
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tramitacoes.map((t) => (
            <div
              key={t.id}
              className="bg-surface border border-border p-4 hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded-full border',
                        getAutorStyle(t.autor),
                      )}
                    >
                      {TRAMITACAO_AUTOR_LABELS[t.autor]}
                    </span>
                    <span className="text-xs font-mono text-ink-muted">
                      {getActoLabel(t.actoType)}
                    </span>
                    <span className="text-xs font-mono text-ink-muted">•</span>
                    <span className="text-xs font-mono text-ink-muted">
                      {formatActoDate(t.actoDate)}
                    </span>
                  </div>
                  <p className="font-medium text-ink">{t.title}</p>
                  {t.description && (
                    <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {t.generatedPrazo && (
                      <Link
                        href={`/prazos/${t.generatedPrazo.id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-warning/10 text-warning border border-warning/20 rounded-full hover:bg-warning/20 transition-colors"
                      >
                        <Clock className="w-3 h-3" />
                        Prazo: {t.generatedPrazo.title}
                      </Link>
                    )}
                    {t.advancedToStage && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-info/10 text-info border border-info/20 rounded-full">
                        <ArrowRight className="w-3 h-3" />
                        Fase → {t.advancedToStage}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono text-ink-muted whitespace-nowrap">
                  {t.user.firstName} {t.user.lastName}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
