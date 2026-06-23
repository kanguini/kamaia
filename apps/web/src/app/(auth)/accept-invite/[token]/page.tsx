'use client'

/**
 * Kamaia CLM — Aceitar convite via magic-link.
 *
 * Endpoint backend: POST /accept-invite (sem auth — token IS auth).
 *
 * Dois caminhos possíveis:
 *  1. User já existe e tem password → aceita logo (sem pedir password)
 *  2. User é novo (criado pelo invite) → server devolve
 *     `needsPassword: true`; mostramos input de password; re-POST com
 *     `password`, server cria hash bcrypt e marca aceite numa tx.
 *
 * No fim, redirecciona para /login com email pré-preenchido e mensagem
 * de sucesso.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'

interface NeedsPasswordResponse {
  needsPassword: true
  membershipId: string
  userEmail: string
}

interface AcceptedResponse {
  needsPassword: false
  membership: { id: string; tenantId: string; role: string }
  userEmail: string
}

type AcceptResponse = NeedsPasswordResponse | AcceptedResponse

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [phase, setPhase] = useState<'checking' | 'needs-password' | 'success' | 'error'>('checking')
  const [userEmail, setUserEmail] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Primeira tentativa: aceitar sem password (caso o user já existir e ter)
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api<AcceptResponse>('/accept-invite', {
      method: 'POST',
      noTenant: true,
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (cancelled) return
        if (res.needsPassword) {
          setUserEmail(res.userEmail)
          setPhase('needs-password')
        } else {
          setUserEmail(res.userEmail)
          setPhase('success')
        }
      })
      .catch((e: { error?: string }) => {
        if (cancelled) return
        setError(e?.error ?? 'Convite inválido ou expirado.')
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const submitWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Palavra-passe deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Palavras-passe não coincidem.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api<AcceptResponse>('/accept-invite', {
        method: 'POST',
        noTenant: true,
        body: JSON.stringify({ token, password }),
      })
      if (!res.needsPassword) {
        setPhase('success')
      } else {
        setError('Não foi possível definir a palavra-passe. Tenta de novo.')
      }
    } catch (e) {
      setError((e as { error?: string })?.error ?? 'Erro a aceitar convite.')
    } finally {
      setSubmitting(false)
    }
  }

  // Após sucesso: tenta auto-login se o user definiu password agora;
  // caso contrário, redirecciona para /login com email pré-preenchido.
  useEffect(() => {
    if (phase !== 'success') return
    let cancelled = false
    const timer = setTimeout(async () => {
      if (cancelled) return
      // Se temos password (acabou de definir), tenta auto sign-in
      if (password) {
        try {
          const result = await signIn('credentials', {
            email: userEmail,
            password,
            redirect: false,
          })
          if (!cancelled && !result?.error) {
            router.push('/')
            router.refresh()
            return
          }
        } catch {
          /* falla — redirecciona para login */
        }
      }
      if (!cancelled) {
        router.push(`/login?email=${encodeURIComponent(userEmail)}&accepted=1`)
      }
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [phase, password, userEmail, router])

  return (
    <>
      <h1>Aceitar convite</h1>

      {phase === 'checking' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--k2-text-dim)' }}>
          <Loader2 size={16} className="spin" /> A validar convite…
        </div>
      )}

      {phase === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} /> {error ?? 'Convite inválido.'}
          </div>
          <p style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>
            O link pode ter expirado (7 dias) ou já ter sido usado. Contacta quem te convidou para reenviar.
          </p>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--k2-accent)' }}>
            ← Ir para login
          </Link>
        </div>
      )}

      {phase === 'needs-password' && (
        <>
          <p className="lede">
            Vamos definir a tua palavra-passe para concluir o registo em{' '}
            <strong style={{ color: 'var(--k2-text)' }}>{userEmail}</strong>.
          </p>

          {error && (
            <div className="error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <form onSubmit={submitWithPassword} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label className="field">Palavra-passe (mín. 8 chars)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••••"
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={8}
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Mostrar/ocultar palavra-passe"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    color: 'var(--k2-text-mute)',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="field">Confirmar palavra-passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="•••••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>

            <button type="submit" disabled={submitting} className="primary">
              {submitting ? (
                <>
                  <Loader2 size={14} className="spin" /> A aceitar…
                </>
              ) : (
                'Aceitar convite'
              )}
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 8 }}>
            Ao continuar, concordas com os termos de utilização do Kamaia CLM.
          </p>
        </>
      )}

      {phase === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16a34a' }}>
            <CheckCircle2 size={18} /> Convite aceite!
          </div>
          <p style={{ fontSize: 14, color: 'var(--k2-text-dim)' }}>
            A redireccionar para a tua organização…
          </p>
        </div>
      )}

      <style jsx>{`
        .spin {
          animation: spin 800ms linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .primary {
          padding: 10px 16px;
          background: var(--k2-accent);
          color: white;
          border: 0;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }
        .primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  )
}
