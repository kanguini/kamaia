'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
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
    <main className="min-h-[60vh] bg-white text-neutral-900">
      <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
          Erro inesperado
        </span>
        <h1 className="mt-3 max-w-2xl font-sans text-[clamp(32px,4vw,48px)] font-medium leading-[1.05] tracking-[-0.025em]">
          Algo correu mal a carregar esta página.
        </h1>
        <p className="mt-4 max-w-lg text-base text-neutral-600">
          A equipa do Kamaia já foi notificada. Volta a tentar — se persistir,
          escreve para <a className="underline underline-offset-4" href="mailto:hello@kamaia.cc">hello@kamaia.cc</a>.
        </p>
        {error?.digest && (
          <p className="mt-3 text-xs text-neutral-500">
            ref: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-all hover:scale-[1.02]"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-neutral-300 bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-900 backdrop-blur-sm transition-colors hover:bg-neutral-100"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  )
}
