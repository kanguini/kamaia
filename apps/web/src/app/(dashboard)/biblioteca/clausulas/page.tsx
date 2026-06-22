'use client'

/**
 * Kamaia CLM — Cláusulas library.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { PaginatedResponse } from '@kamaia/shared-types'

interface Clausula {
  id: string
  titulo: string
  conteudo: string
  categoria: string | null
  tags: string[]
}

export default function ClausulasPage() {
  const { data: session, status } = useSession()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Clausula[]>([])
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (search) sp.set('search', search)
    sp.set('limit', '50')
    return sp.toString()
  }, [search])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    api<PaginatedResponse<Clausula>>(`/clausulas?${query}`, { token: session.accessToken })
      .then((res) => !cancelled && setItems(res.data ?? []))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, session?.accessToken, status])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Cláusulas</h1>
        <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
          Biblioteca de cláusulas reutilizáveis.
        </p>
      </header>

      <div style={{ position: 'relative', maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--k2-text-mute)' }} />
        <Input
          placeholder="Procurar cláusula…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {loading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}
      {!loading && items.length === 0 && (
        <div style={{ color: 'var(--k2-text-mute)' }}>Sem resultados.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 14,
              background: 'var(--k2-bg-elev)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 500 }}>{c.titulo}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {c.categoria && <Badge variant="info">{c.categoria}</Badge>}
                {c.tags.map((t) => (
                  <Badge key={t} variant="default">{t}</Badge>
                ))}
              </div>
            </div>
            <pre style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {c.conteudo}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
