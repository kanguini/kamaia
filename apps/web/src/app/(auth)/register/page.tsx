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
import { Logo } from '@/components/ui/logo'

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
    } catch (err: unknown) {
      // Breadcrumb first — we want the raw shape in devtools regardless
      // of what we show the user.
      // eslint-disable-next-line no-console
      console.error('[register] failed', err)

      // Possible error shapes we need to handle:
      //  1. Our api helper: { error, code, status }
      //  2. NestJS default 500: { statusCode, message }
      //  3. Network / CORS: thrown Error with message
      //  4. Validation: { error: 'VALIDATION_ERROR', code: 'VALIDATION_FAILED', details }
      const e = (err && typeof err === 'object' ? err : {}) as {
        error?: string
        code?: string
        status?: number
        statusCode?: number
        message?: string | string[]
        details?: unknown
      }

      const code = e.code
      const httpStatus = e.status ?? e.statusCode
      const backendError =
        (typeof e.error === 'string' && e.error) ||
        (typeof e.message === 'string' && e.message) ||
        (Array.isArray(e.message) && e.message.join('; ')) ||
        undefined

      setError(translateAuthError(code, backendError, httpStatus))
    } finally {
      setIsLoading(false)
    }
  }

function translateAuthError(
  code: string | undefined,
  fallback: string | undefined,
  status: number | undefined,
): string {
  switch (code) {
    case 'USER_EXISTS':
      return 'Já existe uma conta com este email. Faça login ou recupere a palavra-passe.'
    case 'VALIDATION_FAILED':
    case 'VALIDATION_ERROR':
      return fallback || 'Dados inválidos. Verifique os campos e tente novamente.'
    case 'UNAUTHORIZED':
      return 'Sessão expirada. Recarregue a página.'
    case 'REGISTRATION_FAILED':
      return fallback || 'Não foi possível concluir o registo. Verifique os dados.'
    case 'DB_SCHEMA_OUT_OF_SYNC':
      return 'Servidor temporariamente em actualização. Tente em alguns minutos.'
    case 'GABINETE_NIF_EXISTS':
      return 'Este NIF de gabinete já está registado.'
    case 'DUPLICATE_VALUE':
      return fallback || 'Valor duplicado. Verifique email/NIF.'
  }
  // If we have no code, surface the backend message (still helpful) and
  // include the HTTP status so debugging is possible without devtools.
  if (fallback) return `${fallback}${status ? ` (HTTP ${status})` : ''}`
  if (status === 500) {
    return 'Erro no servidor. A equipa Kamaia foi notificada. Tente novamente em instantes.'
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Servidor temporariamente indisponível. Tente em alguns segundos.'
  }
  if (!status) {
    return 'Não foi possível ligar ao servidor. Verifique a sua conexão.'
  }
  return `Erro ao criar conta (HTTP ${status}). Tente novamente.`
}

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="sr-only">Kamaia</h1>
        <div aria-hidden="true" className="text-ink inline-block">
          <Logo height={44} />
        </div>
        <p className="text-ink-muted text-sm mt-3">Gestão Jurídica Inteligente</p>
      </div>

      <div className="bg-surface border border-border p-8">
        <h2 className="font-display text-2xl font-semibold text-ink mb-6 text-center">Criar conta</h2>

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
