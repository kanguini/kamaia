'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Palavra-passe deve ter pelo menos 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email ou palavra-passe incorretos')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch {
      setError('Erro ao fazer login com Google')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-14 h-14 bg-ink text-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Scale className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-bold text-ink tracking-tight">Kamaia</h1>
        <p className="text-ink-muted text-sm mt-1">Gestão Jurídica Inteligente</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-8 shadow-lg">
        <h2 className="text-xl font-semibold text-ink mb-6">
          Entrar na conta
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border rounded-xl transition-colors text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/40',
                errors.email ? 'border-red-400' : 'border-border',
              )}
              placeholder="seu@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              Palavra-passe
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className={cn(
                'w-full px-4 py-2.5 bg-surface border rounded-xl transition-colors text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/40',
                errors.password ? 'border-red-400' : 'border-border',
              )}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Esqueci a palavra-passe
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'w-full [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5 rounded-xl',
              'hover:[background:var(--color-btn-primary-hover)] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-surface text-ink-muted">ou</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={cn(
              'w-full mt-4 bg-transparent border border-border text-ink font-medium py-2.5 rounded-xl',
              'hover:bg-surface-raised transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            Entrar com Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Não tem conta?{' '}
          <Link href="/register" className="text-ink hover:underline font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
