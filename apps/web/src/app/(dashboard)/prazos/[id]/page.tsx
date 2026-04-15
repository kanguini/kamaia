'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { PrazoType, PrazoStatus } from '@kamaia/shared-types'
import { useSession } from 'next-auth/react'

interface Prazo {
  id: string
  title: string
  description: string | null
  type: PrazoType
  dueDate: string
  status: PrazoStatus
  isUrgent: boolean
  alertBeforeHours: number | null
  createdAt: string
  processo: {
    id: string
    processoNumber: string
    title: string
  }
}

const PRAZO_TYPE_LABELS: Record<PrazoType, string> = {
  [PrazoType.CONTESTACAO]: 'Contestacao',
  [PrazoType.RECURSO]: 'Recurso',
  [PrazoType.RESPOSTA]: 'Resposta',
  [PrazoType.ALEGACOES]: 'Alegacoes',
  [PrazoType.AUDIENCIA]: 'Audiencia',
  [PrazoType.OUTRO]: 'Outro',
}

function PrazoSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 bg-surface-raised rounded w-1/3" />
      <div className="bg-surface-raised p-6 h-48" />
    </div>
  )
}

function getRelativeTime(date: Date, isPast: boolean): string {
  const now = new Date()
  const diff = Math.abs(date.getTime() - now.getTime())

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) {
    const label = minutes === 1 ? 'minuto' : 'minutos'
    return isPast ? `ha ${minutes} ${label}` : `${minutes} ${label}`
  }
  if (hours < 24) {
    const label = hours === 1 ? 'hora' : 'horas'
    return isPast ? `ha ${hours} ${label}` : `${hours} ${label}`
  }
  const label = days === 1 ? 'dia' : 'dias'
  return isPast ? `ha ${days} ${label}` : `${days} ${label}`
}

function getCountdownText(dueDate: Date, status: PrazoStatus): { text: string; color: string } {
  const now = new Date()

  if (status === PrazoStatus.CUMPRIDO) {
    return {
      text: `Cumprido em ${dueDate.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      color: 'text-success',
    }
  }

  if (status !== PrazoStatus.PENDENTE) {
    return { text: '', color: '' }
  }

  if (dueDate < now) {
    return {
      text: `Atrasado ${getRelativeTime(dueDate, true)}`,
      color: 'text-danger font-bold',
    }
  }

  const diff = dueDate.getTime() - now.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  return {
    text: `Faltam ${days} dias e ${hours} horas`,
    color: 'text-warning',
  }
}

export default function PrazoDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: session } = useSession()

  const { data: prazo, loading, error, refetch } = useApi<Prazo>(`/prazos/${id}`)
  const { mutate: completePrazo, loading: completing } = useMutation(`/prazos/${id}/complete`, 'PATCH')
  const { mutate: updateStatus, loading: updating } = useMutation<{ status: PrazoStatus }>(
    `/prazos/${id}/status`,
    'PATCH',
  )
  const { mutate: deletePrazo, loading: deleting } = useMutation(`/prazos/${id}`, 'DELETE')

  const toast = useToast()

  const handleComplete = async () => {
    const result = await completePrazo(undefined)
    if (result !== null) {
      toast.success('Prazo marcado como cumprido')
      refetch()
    } else {
      toast.error('Erro ao completar prazo')
    }
  }

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar este prazo?')) return
    const result = await updateStatus({ status: PrazoStatus.CANCELADO })
    if (result !== null) {
      toast.success('Prazo cancelado')
      refetch()
    } else {
      toast.error('Erro ao cancelar prazo')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja eliminar este prazo?')) return
    const result = await deletePrazo()
    if (result !== null) {
      toast.success('Prazo eliminado')
      router.push('/prazos')
    } else {
      toast.error('Erro ao eliminar prazo')
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: PrazoStatus, large = false) => {
    const styles = {
      [PrazoStatus.PENDENTE]: 'bg-warning-bg text-warning-text border-warning',
      [PrazoStatus.CUMPRIDO]: 'bg-success-bg text-success-text border-success',
      [PrazoStatus.EXPIRADO]: 'bg-danger-bg text-danger-text border-danger',
      [PrazoStatus.CANCELADO]: 'bg-surface-raised text-ink-muted border-border',
    }
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border font-mono',
          large ? 'px-4 py-1.5 text-sm' : 'px-2 py-0.5 text-xs',
          styles[status],
        )}
      >
        {status}
      </span>
    )
  }

  if (loading) return <PrazoSkeleton />

  if (error || !prazo) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4">
          {error || 'Prazo nao encontrado'}
        </div>
      </div>
    )
  }

  const dueDate = new Date(prazo.dueDate)
  const countdown = getCountdownText(dueDate, prazo.status)
  const isSocio = session?.role === 'SOCIO_GESTOR'
  const canComplete = prazo.status === PrazoStatus.PENDENTE
  const canCancel = prazo.status === PrazoStatus.PENDENTE

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/prazos"
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-display text-4xl font-semibold text-ink mb-3">{prazo.title}</h1>
              <div className="flex items-center gap-3">
                {getStatusBadge(prazo.status, true)}
                {prazo.isUrgent && (
                  <div className="flex items-center gap-1 text-danger">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-medium">Urgente</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {countdown.text && (
            <div className={cn('text-2xl font-semibold mb-6', countdown.color)}>
              {countdown.text}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-raised p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Processo</p>
            <Link href={`/processos/${prazo.processo.id}`} className="hover:underline">
              <p className="font-medium text-ink">{prazo.processo.processoNumber}</p>
              <p className="text-sm text-ink-muted">{prazo.processo.title}</p>
            </Link>
          </div>

          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Tipo</p>
            <span className="inline-flex items-center px-3 py-1 bg-info/10 text-info rounded-full text-sm font-mono border border-info/20">
              {PRAZO_TYPE_LABELS[prazo.type]}
            </span>
          </div>

          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Data Limite</p>
            <p className="font-medium text-ink">{formatDate(prazo.dueDate)}</p>
          </div>

          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Alerta</p>
            <p className="text-ink">
              {prazo.alertBeforeHours
                ? `${prazo.alertBeforeHours} horas antes`
                : 'Sem alerta configurado'}
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Urgente</p>
            <p className="text-ink">{prazo.isUrgent ? 'Sim' : 'Nao'}</p>
          </div>

          <div>
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Criado em</p>
            <p className="text-ink">{formatDate(prazo.createdAt)}</p>
          </div>
        </div>
      </div>

      {prazo.description && (
        <div className="bg-surface-raised p-6">
          <h2 className="text-xs font-mono text-ink-muted uppercase mb-3">Descricao</h2>
          <p className="text-ink">{prazo.description}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canComplete && (
          <button
            onClick={handleComplete}
            disabled={completing}
            className={cn(
              'flex items-center gap-2 bg-success text-surface font-medium px-6 py-3',
              'hover:opacity-90 transition-opacity text-base',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {completing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Marcar como Cumprido
              </>
            )}
          </button>
        )}

        <Link
          href={`/prazos/${id}/editar`}
          className="flex items-center gap-2 px-6 py-3 border border-border  text-base font-medium text-ink hover:bg-surface-raised transition-colors"
        >
          <Edit className="w-5 h-5" />
          Editar
        </Link>

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={updating}
            className={cn(
              'flex items-center gap-2 px-6 py-3 border border-muted/20 text-ink-muted  text-base font-medium',
              'hover:bg-muted/10 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {updating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                Cancelar Prazo
              </>
            )}
          </button>
        )}

        {isSocio && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              'flex items-center gap-2 px-6 py-3 border border-danger/20 bg-danger/10 text-danger  text-base font-medium',
              'hover:bg-danger/20 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {deleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                Eliminar
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
