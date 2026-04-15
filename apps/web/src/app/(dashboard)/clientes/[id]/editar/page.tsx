'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ClienteType } from '@kamaia/shared-types'

const updateClienteSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  type: z.nativeEnum(ClienteType, { required_error: 'Tipo e obrigatorio' }),
  nif: z.string().optional(),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type UpdateClienteData = z.infer<typeof updateClienteSchema>

interface Cliente {
  id: string
  name: string
  type: ClienteType
  nif: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

export default function EditarClientePage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: cliente, loading: loadingCliente } = useApi<Cliente>(`/clientes/${id}`)
  const { mutate, loading, error } = useMutation<UpdateClienteData>(`/clientes/${id}`, 'PUT')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateClienteData>({
    resolver: zodResolver(updateClienteSchema),
  })

  useEffect(() => {
    if (cliente) {
      reset({
        name: cliente.name,
        type: cliente.type,
        nif: cliente.nif || '',
        email: cliente.email || '',
        phone: cliente.phone || '',
        address: cliente.address || '',
        notes: cliente.notes || '',
      })
    }
  }, [cliente, reset])

  const toast = useToast()

  const onSubmit = async (data: UpdateClienteData) => {
    const result = await mutate(data)
    if (result !== null) {
      toast.success('Cliente actualizado')
      router.push(`/clientes/${id}`)
    } else {
      toast.error('Erro ao actualizar cliente')
    }
  }

  if (loadingCliente) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-surface-raised rounded w-1/3" />
        <div className="bg-surface-raised p-6 space-y-4">
          <div className="h-12 bg-border rounded" />
          <div className="h-12 bg-border rounded" />
          <div className="h-12 bg-border rounded" />
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 text-danger  p-4">
          Cliente nao encontrado
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/clientes/${id}`}
          className="p-2 hover:bg-surface border border-border transition-colors text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-4xl font-semibold text-ink">Editar Cliente</h1>
      </div>

      <div className="bg-surface-raised p-6">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger  p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-2">
              Nome <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              {...register('name')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.name ? 'border-danger' : 'border-border',
              )}
              placeholder="Nome completo ou razao social"
            />
            {errors.name && <p className="text-danger text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-ink mb-3">
              Tipo <span className="text-danger">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input
                  type="radio"
                  value={ClienteType.INDIVIDUAL}
                  {...register('type')}
                  className="w-4 h-4 text-ink border-border focus:ring-ink"
                />
                <span className="text-sm font-medium text-ink">Individual</span>
              </label>
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input
                  type="radio"
                  value={ClienteType.EMPRESA}
                  {...register('type')}
                  className="w-4 h-4 text-ink border-border focus:ring-ink"
                />
                <span className="text-sm font-medium text-ink">Empresa</span>
              </label>
            </div>
            {errors.type && <p className="text-danger text-sm mt-1">{errors.type.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nif" className="block text-sm font-mono font-medium text-ink mb-2">
                NIF
              </label>
              <input
                id="nif"
                type="text"
                {...register('nif')}
                className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                placeholder="Numero de identificacao fiscal"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-mono font-medium text-ink mb-2">
                Telefone
              </label>
              <input
                id="phone"
                type="text"
                {...register('phone')}
                className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                placeholder="+244 900 000 000"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-mono font-medium text-ink mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border  transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.email ? 'border-danger' : 'border-border',
              )}
              placeholder="email@exemplo.com"
            />
            {errors.email && <p className="text-danger text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-mono font-medium text-ink mb-2">
              Endereco
            </label>
            <textarea
              id="address"
              {...register('address')}
              rows={3}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              placeholder="Endereco completo"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-mono font-medium text-ink mb-2">
              Notas
            </label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none"
              placeholder="Informacoes adicionais sobre o cliente"
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex-1 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5 ',
                'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Alteracoes'
              )}
            </button>
            <Link
              href={`/clientes/${id}`}
              className="px-6 py-2.5 border border-border  text-sm font-medium text-ink-muted hover:bg-surface transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
