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
      setError('Erro ao iniciar sessão. Tenta novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocial = async (provider: 'google') => {
    setIsLoading(true)
    try {
      await signIn(provider, { callbackUrl: '/' })
    } catch {
      setError('Erro ao iniciar sessão.')
      setIsLoading(false)
    }
  }

  return (
    <>
      <AccentGlyph />
      <h1>Entrar</h1>
      <p className="lede">Acede ao teu gabinete para continuar.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="field">Email</label>
          <input
            type="email"
            {...register('email')}
            placeholder="tu@gabinete.ao"
            autoComplete="email"
          />
          {errors.email && <div className="field-error">{errors.email.message}</div>}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="field">Palavra-passe</label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 11,
                color: 'var(--k2-text-dim)',
                textDecoration: 'none',
              }}
            >
              Esqueci-me
            </Link>
          </div>
          <input
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

      <div className="or">ou continuar com</div>
      <div className="socials">
        <button
          type="button"
          aria-label="Google"
          onClick={() => handleSocial('google')}
          disabled={isLoading}
        >
          <GoogleIcon />
        </button>
        <button type="button" aria-label="GitHub" disabled>
          <GithubIcon />
        </button>
        <button type="button" aria-label="Apple" disabled>
          <AppleIcon />
        </button>
      </div>

      <p className="alt">
        Não tens conta? <Link href="/register">Criar conta</Link>
      </p>
    </>
  )
}

// Small accent "sparkle" glyph — visual cue matching the design mock
function AccentGlyph() {
  return (
    <span className="glyph" aria-hidden="true">
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
      </svg>
    </span>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .296a12 12 0 0 0-3.79 23.4c.6.113.82-.26.82-.577 0-.285-.01-1.04-.016-2.04-3.338.726-4.042-1.612-4.042-1.612-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.238 1.84 1.238 1.071 1.834 2.809 1.304 3.494.997.108-.776.42-1.305.763-1.605-2.665-.305-5.467-1.334-5.467-5.933 0-1.31.468-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.49 11.49 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.552 3.296-1.23 3.296-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.624-5.48 5.922.43.372.814 1.102.814 2.222 0 1.606-.014 2.896-.014 3.292 0 .32.216.695.825.577A12 12 0 0 0 12 .296z"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  )
}
