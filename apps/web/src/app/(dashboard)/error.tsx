'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-xl mx-auto py-20 text-center">
      <h2 className="font-display text-3xl font-semibold text-ink mb-4">
        Ocorreu um erro
      </h2>
      <p className="text-ink-muted mb-2">{error.message}</p>
      {error.digest && (
        <p className="text-xs font-mono text-ink-muted mb-6">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-6 py-2 [background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)]  font-medium hover:[background:var(--color-btn-primary-hover)] transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  )
}
