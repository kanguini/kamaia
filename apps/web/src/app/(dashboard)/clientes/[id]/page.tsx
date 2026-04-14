'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, User, Building2, Scale } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ClienteType, ProcessoType, ProcessoStatus } from '@kamaia/shared-types'
import { useSession } from 'next-auth/react'

interface Cliente {
  id: string
  name: string
  type: ClienteType
  nif: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  createdAt: string
  status: string
  processos: {
    id: string
    processoNumber: string
    title: string
    type: ProcessoType
    status: ProcessoStatus
    createdAt: string
  }[]
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div>
      <p className="text-xs font-mono text-ink-muted uppercase mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-ink-muted" />}
        <p className="text-ink font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

function ClienteSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 bg-surface-raised rounded w-1/3" />
      <div className="bg-surface-raised p-6 space-y-4">
        <div className="h-6 bg-border rounded w-1/2" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-border rounded" />
          <div className="h-12 bg-border rounded" />
        </div>
      </div>
    </div>
  )
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const { data: cliente, loading, error } = useApi<Cliente>(`/clientes/${id}`)
  const { mutate: deleteCliente, loading: deleting } = useMutation(`/clientes/${id}`, 'DELETE')

  const toast = useToast()

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja eliminar este cliente?')) return
    const result = await deleteCliente()
    if (result !== null) {
      toast.success('Cliente eliminado')
      router.push('/clientes')
    } else {
      toast.error('Erro ao eliminar cliente')
    }
  }

  const getTypeBadge = (type: ClienteType) => {
    const styles = {
      [ClienteType.INDIVIDUAL]: 'bg-info-bg text-info-text border-info',
      [ClienteType.EMPRESA]: 'bg-warning-bg text-warning-text border-warning',
    }
    const icons = {
      [ClienteType.INDIVIDUAL]: User,
      [ClienteType.EMPRESA]: Building2,
    }
    const labels = {
      [ClienteType.INDIVIDUAL]: 'Individual',
      [ClienteType.EMPRESA]: 'Empresa',
    }
    const Icon = icons[type]
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-3 py-1 text-sm font-mono rounded-full border',
          styles[type],
        )}
      >
        <Icon className="w-4 h-4" />
        {labels[type]}
      </span>
    )
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (loading) return <ClienteSkeleton />

  if (error || !cliente) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4">
          {error || 'Cliente nao encontrado'}
        </div>
      </div>
    )
  }

  const isSocio = session?.role === 'SOCIO_GESTOR'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/clientes"
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-4xl font-semibold text-ink flex-1">{cliente.name}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/clientes/${id}/editar`}
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

      <div className="flex items-center gap-3">
        {getTypeBadge(cliente.type)}
      </div>

      <div className="bg-surface-raised p-6">
        <h2 className="font-display text-2xl font-semibold text-ink mb-6">Informacoes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InfoCard label="NIF" value={cliente.nif || '—'} />
          <InfoCard label="Email" value={cliente.email || '—'} />
          <InfoCard label="Telefone" value={cliente.phone || '—'} />
          <InfoCard label="Data de Entrada" value={formatDate(cliente.createdAt)} />
          <InfoCard label="Endereco" value={cliente.address || '—'} />
          <InfoCard label="Estado" value={cliente.status || 'ACTIVO'} />
        </div>

        {cliente.notes && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs font-mono text-ink-muted uppercase mb-2">Notas</p>
            <p className="text-ink whitespace-pre-wrap">{cliente.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-surface-raised p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold text-ink">Processos Associados</h2>
          <span className="px-3 py-1 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] text-sm font-mono rounded">
            {cliente.processos.length}
          </span>
        </div>

        {cliente.processos.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-3">
              <Scale className="w-6 h-6 text-ink-muted" />
            </div>
            <p className="text-ink-muted text-sm">Nenhum processo associado a este cliente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cliente.processos.map((processo) => (
              <Link
                key={processo.id}
                href={`/processos/${processo.id}`}
                className="block bg-surface  p-4 hover:bg-surface-raised transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-ink-muted">
                        {processo.processoNumber}
                      </span>
                      {getStatusBadge(processo.status)}
                    </div>
                    <h3 className="font-medium text-ink mb-1">{processo.title}</h3>
                    <p className="text-sm text-ink-muted">{processo.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-muted">{formatDate(processo.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
