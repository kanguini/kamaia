'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Nome muito curto'),
    lastName: z.string().min(2, 'Apelido muito curto'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
    oaaNumber: z.string().optional(),
    specialty: z.string().optional(),
    gabineteName: z.string().min(3, 'Nome do gabinete muito curto'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As palavras-passe não coincidem',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

function translateAuthError(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case 'USER_EXISTS':
      return 'Já existe uma conta com este email.'
    case 'VALIDATION_FAILED':
    case 'VALIDATION_ERROR':
      return fallback || 'Dados inválidos.'
    case 'DB_SCHEMA_OUT_OF_SYNC':
      return 'Servidor em actualização. Tenta em alguns minutos.'
    case 'GABINETE_NIF_EXISTS':
      return 'Este NIF de gabinete já está registado.'
    default:
      return fallback || 'Erro ao criar conta.'
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

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
      if (result?.error) setError('Conta criada, mas erro ao iniciar sessão.')
      else {
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('[register] failed', err)
      const e = (err && typeof err === 'object' ? err : {}) as {
        error?: string
        code?: string
        message?: string | string[]
      }
      const fallback =
        (typeof e.error === 'string' && e.error) ||
        (typeof e.message === 'string' && e.message) ||
        (Array.isArray(e.message) && e.message.join('; ')) ||
        undefined
      setError(translateAuthError(e.code, fallback))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <span className="glyph" aria-hidden="true">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
        </svg>
      </span>

      <h1>Criar conta</h1>
      <p className="lede">
        Regista o teu gabinete e começa a gerir processos, prazos e facturação em minutos.
      </p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 12 }}>
        <div className="field-row">
          <div>
            <label className="field">Nome</label>
            <input type="text" {...register('firstName')} placeholder="Helder" />
            {errors.firstName && <div className="field-error">{errors.firstName.message}</div>}
          </div>
          <div>
            <label className="field">Apelido</label>
            <input type="text" {...register('lastName')} placeholder="Maiato" />
            {errors.lastName && <div className="field-error">{errors.lastName.message}</div>}
          </div>
        </div>

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
          <label className="field">Palavra-passe</label>
          <div className="pw-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
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

        <div>
          <label className="field">Confirmar palavra-passe</label>
          <div className="pw-wrap">
            <input
              type={showConfirm ? 'text' : 'password'}
              {...register('confirmPassword')}
              placeholder="Repetir"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <div className="field-error">{errors.confirmPassword.message}</div>
          )}
        </div>

        <div>
          <label className="field">Nome do gabinete</label>
          <input
            type="text"
            {...register('gabineteName')}
            placeholder="Ex: Maiato &amp; Associados"
          />
          {errors.gabineteName && (
            <div className="field-error">{errors.gabineteName.message}</div>
          )}
        </div>

        <div className="field-row">
          <div>
            <label className="field">Nº OAA</label>
            <input type="text" {...register('oaaNumber')} placeholder="12345" />
          </div>
          <div>
            <label className="field">Especialidade</label>
            <input type="text" {...register('specialty')} placeholder="Civil, Penal…" />
          </div>
        </div>

        <button className="primary" type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
          Criar conta
        </button>
      </form>

      <p className="alt">
        Já tens conta? <Link href="/login">Entrar</Link>
      </p>

      <style jsx>{`
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
