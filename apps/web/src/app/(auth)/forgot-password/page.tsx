'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'

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
      setError(msg || 'Erro ao enviar pedido. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div>
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
        <h1>Pedido enviado.</h1>
        <p className="lede">
          Se <strong style={{ color: 'var(--k2-text)' }}>{email}</strong>{' '}
          corresponder a uma conta, recebeste um email com o link de
          recuperação. Expira em 1 hora.
        </p>
        <p className="alt">
          Não recebeste? Verifica a pasta de spam ou{' '}
          <button type="button" className="link" onClick={() => setSent(false)}>
            tenta outro email
          </button>
          .
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/login">
            <button type="button" className="secondary">
              ← Voltar ao login
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1>Recuperar palavra-passe.</h1>
      <p className="lede">
        Introduz o teu email e enviamos-te um link para definires uma nova.
      </p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <div>
          <label className="field">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@gabinete.ao"
            autoComplete="email"
          />
        </div>
        <button className="primary" type="submit" disabled={loading || !email.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Enviar link de recuperação
        </button>
      </form>

      <p className="alt">
        Lembraste-te? <Link href="/login">Entrar</Link>
      </p>
    </div>
  )
}
