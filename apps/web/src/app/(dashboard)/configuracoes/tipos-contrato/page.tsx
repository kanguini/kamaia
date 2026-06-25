'use client'

/**
 * Redirect — Sprint 3.2 moveu Tipos de Contrato para
 * /biblioteca/tipos. Mantemos este path para deep links externos
 * (emails antigos, bookmarks) não partirem.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfiguracoesTiposRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/biblioteca/tipos')
  }, [router])
  return (
    <div
      style={{
        color: 'var(--k2-text-mute)',
        fontSize: 13,
        padding: 12,
      }}
    >
      A redireccionar…
    </div>
  )
}
