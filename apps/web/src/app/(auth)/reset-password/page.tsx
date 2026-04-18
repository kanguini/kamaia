'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Logo } from '@/components/ui/logo'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Link inválido. Volte a pedir a recuperação.')
      return
    }
    if (newPassword.length < 8) {
      setError('A palavra-passe deve ter pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As palavras-passe não coincidem.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: unknown) {
      const e = err as { code?: string; error?: string }
      if (e.code === 'INVALID_TOKEN') {
        setError('Link expirou ou é inválido. Peça um novo.')
      } else {
        setError(e.error || 'Erro ao repor palavra-passe.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="font-display text-xl font-semibold text-ink">Link inválido</h2>
        <p className="text-sm text-ink-muted">
          Este link não é válido ou já foi usado.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-2 text-sm text-ink hover:underline font-medium"
        >
          Pedir novo link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Palavra-passe actualizada
        </h2>
        <p className="text-sm text-ink-muted">
          A redireccionar para o login...
        </p>
      </div>
    )
  }

  return (
    <>
      <h2 className="font-display text-2xl font-semibold text-ink mb-2 text-center">
        Nova palavra-passe
      </h2>
      <p className="text-ink-muted text-sm mb-6 text-center">
        Escolha uma nova palavra-passe para a sua conta.
      </p>

      {error && (
        <div className="bg-danger-bg border border-danger/20 text-danger p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="newPassword"
            className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
          >
            Nova palavra-passe
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
          >
            Confirmar palavra-passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'w-full [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5 rounded-lg',
            'hover:[background:var(--color-btn-primary-hover)] transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2',
          )}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Actualizar palavra-passe
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="sr-only">Kamaia</h1>
        <div aria-hidden="true" className="text-ink inline-block">
          <Logo height={35} />
        </div>
      </div>

      <div className="bg-surface border border-border p-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
