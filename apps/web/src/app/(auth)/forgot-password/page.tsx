'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-display text-5xl font-semibold text-amber mb-2">Kamaia</h1>
        <p className="text-bone text-sm font-mono">Gestao Juridica Inteligente</p>
      </div>

      <div className="bg-bone rounded-xl p-8 shadow-lg">
        <h2 className="font-display text-2xl font-semibold text-ink mb-2">
          Recuperar palavra-passe
        </h2>
        <p className="text-muted text-sm mb-6">
          Introduza o seu email para receber um link de recuperacao.
        </p>

        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-mono font-medium text-ink mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-paper border border-border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          <button
            type="submit"
            disabled
            className={cn(
              'w-full bg-amber text-ink font-medium py-2.5 rounded-lg',
              'hover:bg-amber-600 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            Enviar link de recuperacao
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Lembrou-se da palavra-passe?{' '}
          <Link href="/login" className="text-amber hover:text-amber-600 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
