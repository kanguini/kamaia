'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-AO">
      <body>
        <main className="min-h-screen flex items-center justify-center bg-surface text-ink px-6">
          <div className="max-w-xl text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
              Erro inesperado
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold">
              Não foi possível carregar a Kamaia.
            </h1>
            <p className="mt-4 text-ink-muted">
              Já estamos a investigar. Tenta novamente ou volta ao início. Se
              persistir, escreve para{' '}
              <a className="underline underline-offset-4" href="mailto:hello@kamaia.cc">
                hello@kamaia.cc
              </a>
              .
            </p>
            {error?.digest && (
              <p className="mt-3 text-xs font-mono text-ink-muted">
                ref: {error.digest}
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-md bg-ink text-surface font-medium"
              >
                Tentar de novo
              </button>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-md border border-border text-ink font-medium"
              >
                Voltar ao início
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
