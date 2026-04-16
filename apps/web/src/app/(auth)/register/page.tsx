'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    lastName: z.string().min(2, 'Apelido deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email invalido'),
    password: z.string().min(6, 'Palavra-passe deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
    oaaNumber: z.string().optional(),
    specialty: z.string().optional(),
    gabineteName: z.string().min(3, 'Nome do gabinete deve ter pelo menos 3 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As palavras-passe não coincidem',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          oaaNumber: data.oaaNumber || undefined,
          specialty: data.specialty || undefined,
          gabineteName: data.gabineteName,
        }),
      })

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Conta criada, mas erro ao fazer login. Tente novamente.')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-display text-5xl font-semibold text-ink mb-2">Kamaia</h1>
        <p className="text-ink-muted text-sm font-mono">Gestão Jurídica Inteligente</p>
      </div>

      <div className="bg-surface border border-border p-8 shadow-lg">
        <h2 className="font-display text-2xl font-semibold text-ink mb-6">Criar conta</h2>

        {error && (
          <div className="bg-danger-bg border border-danger/20 text-danger p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
              >
                Nome
              </label>
              <input
                id="firstName"
                type="text"
                {...register('firstName')}
                className={cn(
                  'w-full px-4 py-2.5 bg-surface border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                  errors.firstName ? 'border-danger' : 'border-border',
                )}
                placeholder="Nome"
              />
              {errors.firstName && (
                <p className="text-danger text-sm mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
              >
                Apelido
              </label>
              <input
                id="lastName"
                type="text"
                {...register('lastName')}
                className={cn(
                  'w-full px-4 py-2.5 bg-surface border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                  errors.lastName ? 'border-danger' : 'border-border',
                )}
                placeholder="Apelido"
              />
              {errors.lastName && (
                <p className="text-danger text-sm mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.email ? 'border-danger' : 'border-border',
              )}
              placeholder="seu@email.com"
            />
            {errors.email && <p className="text-danger text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
              >
                Palavra-passe
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className={cn(
                  'w-full px-4 py-2.5 bg-surface border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                  errors.password ? 'border-danger' : 'border-border',
                )}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-danger text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
              >
                Confirmar
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                className={cn(
                  'w-full px-4 py-2.5 bg-surface border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                  errors.confirmPassword ? 'border-danger' : 'border-border',
                )}
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="text-danger text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="gabineteName"
              className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
            >
              Nome do Gabinete
            </label>
            <input
              id="gabineteName"
              type="text"
              {...register('gabineteName')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent',
                errors.gabineteName ? 'border-danger' : 'border-border',
              )}
              placeholder="Nome do seu gabinete juridico"
            />
            {errors.gabineteName && (
              <p className="text-danger text-sm mt-1">{errors.gabineteName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="oaaNumber"
                className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
              >
                Numero OAA (opcional)
              </label>
              <input
                id="oaaNumber"
                type="text"
                {...register('oaaNumber')}
                className="w-full px-4 py-2.5 bg-surface border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                placeholder="12345"
              />
            </div>

            <div>
              <label
                htmlFor="specialty"
                className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
              >
                Especialidade (opcional)
              </label>
              <input
                id="specialty"
                type="text"
                {...register('specialty')}
                className="w-full px-4 py-2.5 bg-surface border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                placeholder="Civil, Penal..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'w-full [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5',
              'hover:[background:var(--color-btn-primary-hover)] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Criar conta'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Ja tem conta?{' '}
          <Link href="/login" className="text-ink-muted hover:text-ink font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
