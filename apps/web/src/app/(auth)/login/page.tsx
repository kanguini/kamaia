'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Palavra-passe deve ter pelo menos 6 caracteres'),
})
type LoginFormData = z.infer<typeof loginSchema>

/**
 * Wrapper Suspense — exigido pelo Next 14 App Router quando o
 * componente usa `useSearchParams()` numa página pré-renderizada.
 * Sem isto, `next build` falha com "missing-suspense-with-csr-bailout"
 * porque os search params só existem em runtime.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
          <Loader2 size={22} color="var(--k2-text-mute)" className="animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [lembrar, setLembrar] = useState(true)

  // Query params: ?email=...&accepted=1 (vindo do fluxo /accept-invite)
  const justAccepted = searchParams.get('accepted') === '1'
  const prefilledEmail = searchParams.get('email') ?? ''

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: '' },
  })

  useEffect(() => {
    if (prefilledEmail) setValue('email', prefilledEmail)
  }, [prefilledEmail, setValue])

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        lembrar: lembrar ? 'true' : 'false',
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

  return (
    <>
      <AccentGlyph />
      <h1>Entrar</h1>
      <p className="lede">Acede à tua organização para continuar.</p>

      {justAccepted && !error && (
        <div className="banner-ok" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={14} /> Convite aceite. Inicia sessão para continuar.
        </div>
      )}

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
          <div className="pw-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <div className="field-error">{errors.password.message}</div>}
        </div>

        <label className="remember">
          <input
            type="checkbox"
            checked={lembrar}
            onChange={(e) => setLembrar(e.target.checked)}
          />
          <span>Confiar neste dispositivo (manter sessão 30 dias)</span>
        </label>

        <button className="primary" type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
          Entrar
        </button>
      </form>

      <p className="alt">
        Não tens conta? <Link href="/register">Criar conta</Link>
      </p>

      <style jsx>{`
        .banner-ok {
          background: rgba(16,185,129,0.10);
          border: 1px solid rgba(16,185,129,0.30);
          color: #065f46;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .remember {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--k2-text-dim);
          cursor: pointer;
          user-select: none;
        }
        .remember input {
          width: 15px;
          height: 15px;
          accent-color: var(--k2-accent);
          cursor: pointer;
        }
        .pw-wrap { position: relative; }
        .pw-wrap :global(input) { padding-right: 40px; }
        .pw-toggle {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--k2-text-mute);
          cursor: pointer;
          transition: color 120ms, background 120ms;
        }
        .pw-toggle:hover { color: var(--k2-text); background: var(--k2-bg-elev); }
        .pw-toggle:focus-visible {
          outline: none;
          color: var(--k2-text);
          box-shadow: 0 0 0 2px color-mix(in oklch, var(--k2-accent) 35%, transparent);
        }
      `}</style>
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
