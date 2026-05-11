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
    <main className="min-h-[60vh] bg-black text-white">
      <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
          Erro inesperado
        </span>
        <h1 className="mt-3 max-w-2xl font-playfair text-[clamp(32px,4vw,48px)] font-medium leading-[1.05] tracking-[-0.025em]">
          Algo correu mal a carregar esta página.
        </h1>
        <p className="mt-4 max-w-lg text-base text-white/70">
          A equipa do Kamaia já foi notificada. Volta a tentar — se persistir,
          escreve para <a className="underline underline-offset-4" href="mailto:hello@kamaia.cc">hello@kamaia.cc</a>.
        </p>
        {error?.digest && (
          <p className="mt-3 text-xs text-white/55">
            ref: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  )
}
