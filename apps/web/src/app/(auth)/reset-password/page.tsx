'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return setError('Link inválido. Pede um novo.')
    if (newPassword.length < 8) return setError('A palavra-passe deve ter pelo menos 8 caracteres.')
    if (newPassword !== confirmPassword) return setError('As palavras-passe não coincidem.')

    setLoading(true)
    setError(null)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      setDone(true)
      setTimeout(() => router.push('/login'), 2200)
    } catch (err: unknown) {
      const e = err as { code?: string; error?: string }
      if (e.code === 'INVALID_TOKEN') setError('Link expirou ou é inválido. Pede um novo.')
      else setError(e.error || 'Erro ao repor palavra-passe.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: 'color-mix(in oklch, var(--k2-bad) 20%, transparent)',
            display: 'grid',
            placeItems: 'center',
            marginBottom: 18,
          }}
        >
          <AlertTriangle size={22} color="var(--k2-bad)" />
        </div>
        <h1>Link inválido</h1>
        <p className="lede">Este link já foi usado ou expirou.</p>
        <div style={{ marginTop: 18 }}>
          <Link href="/forgot-password" style={{ display: 'block' }}>
            <button type="button" className="primary">
              Pedir novo link
            </button>
          </Link>
        </div>
      </>
    )
  }

  if (done) {
    return (
      <>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: 'color-mix(in oklch, var(--k2-good) 20%, transparent)',
            display: 'grid',
            placeItems: 'center',
            marginBottom: 18,
          }}
        >
          <CheckCircle2 size={22} color="var(--k2-good)" />
        </div>
        <h1>Palavra-passe actualizada</h1>
        <p className="lede">A redireccionar para o login…</p>
      </>
    )
  }

  return (
    <>
      <span className="glyph" aria-hidden="true">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
        </svg>
      </span>
      <h1>Nova palavra-passe</h1>
      <p className="lede">Escolhe uma palavra-passe segura para a tua conta.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="field">Nova palavra-passe</label>
          <div className="pw-wrap">
            <input
              type={showNew ? 'text' : 'password'}
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
              tabIndex={-1}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="field">Confirmar</label>
          <div className="pw-wrap">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
        </div>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Actualizar palavra-passe
        </button>
      </form>

      <p className="alt">
        Lembraste-te? <Link href="/login">Entrar</Link>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
          <Loader2 size={22} color="var(--k2-text-mute)" className="animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
