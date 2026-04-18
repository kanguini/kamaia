'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Logo } from '@/components/ui/logo'

/**
 * Forgot-password — sends a reset link via backend. Always shows a generic
 * success message (whether or not the email exists) to avoid enumeration
 * attacks.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch (err: unknown) {
      const msg = (err as { error?: string })?.error
      setError(msg || 'Erro ao enviar pedido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="sr-only">Kamaia</h1>
        <div aria-hidden="true" className="text-ink inline-block">
          <Logo height={35} />
        </div>
      </div>

      <div className="bg-surface border border-border p-8">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Pedido enviado
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Se <strong className="text-ink">{email}</strong> corresponder a uma
              conta, um email com instruções para repor a palavra-passe foi
              enviado. O link expira em 1 hora.
            </p>
            <p className="text-xs text-ink-muted">
              Não recebeu? Verifique a pasta de spam. Ou{' '}
              <button
                onClick={() => setSent(false)}
                className="underline text-ink-muted hover:text-ink"
              >
                tentar outro email
              </button>
              .
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 text-sm text-ink-muted hover:text-ink"
            >
              ← Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold text-ink mb-2 text-center">
              Recuperar palavra-passe
            </h2>
            <p className="text-ink-muted text-sm mb-6 text-center">
              Introduza o seu email para receber um link de recuperação.
            </p>

            {error && (
              <div className="bg-danger-bg border border-danger/20 text-danger p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em] mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={cn(
                  'w-full [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] font-medium py-2.5 rounded-lg',
                  'hover:[background:var(--color-btn-primary-hover)] transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2',
                )}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar link de recuperação
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-muted">
              Lembrou-se da palavra-passe?{' '}
              <Link href="/login" className="text-ink font-medium hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
