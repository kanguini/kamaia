'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

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
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })
      if (result?.error) setError('Email ou palavra-passe incorrectos')
      else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Erro ao iniciar sessão. Tente novamente.')
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
      setError('Erro ao iniciar sessão com Google')
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h1>Bem-vindo de volta.</h1>
      <p className="lede">Entra na tua conta Kamaia para continuar.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="field" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            placeholder="tu@gabinete.ao"
            autoComplete="email"
          />
          {errors.email && <div className="field-error">{errors.email.message}</div>}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="field" htmlFor="password">Palavra-passe</label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 11,
                color: 'var(--k2-text-dim)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
            >
              Esqueci-me
            </Link>
          </div>
          <input
            id="password"
            type="password"
            {...register('password')}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {errors.password && <div className="field-error">{errors.password.message}</div>}
        </div>

        <button className="primary" type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
          Entrar
        </button>
      </form>

      <hr className="or" />
      <button
        type="button"
        className="secondary"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        Continuar com Google
      </button>

      <p className="alt">
        Não tens conta? <Link href="/register">Criar conta</Link>
      </p>
    </div>
  )
}
