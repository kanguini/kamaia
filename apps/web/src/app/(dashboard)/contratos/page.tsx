'use client'

/**
 * Kamaia CLM — Contratos list.
 *
 * Cursor-based pagination + filters (estado, tipo, expiraEmDias, search).
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Plus, Search } from 'lucide-react'
import {
  ContratoEstado,
  CONTRATO_ESTADO_LABELS,
  PaginatedResponse,
} from '@kamaia/shared-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { estadoBadgeVariant, estadoLabel, fmtDate } from '@/lib/clm-format'
import { NovoContratoModal } from '@/components/contratos/novo-contrato-modal'

interface ContratoListItem {
  id: string
  numero: string | null
  titulo: string
  estado: ContratoEstado
  dataTermo: string | null
  tipo: { id: string; nome: string } | null
  contrapartePrincipal: { id: string; nome: string } | null
}

interface TipoContrato {
  id: string
  nome: string
}

export default function ContratosListPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<string>('')
  const [tipoId, setTipoId] = useState<string>('')
  const [expiraEmDias, setExpiraEmDias] = useState<string>('')

  const [items, setItems] = useState<ContratoListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tipos, setTipos] = useState<TipoContrato[]>([])
  const [novoOpen, setNovoOpen] = useState(false)

  // Auto-abre modal quando vier de /contratos/novo (que faz redirect)
  // ou de qualquer link com `?novo=1`. Limpa query string a seguir.
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setNovoOpen(true)
      router.replace('/contratos')
    }
  }, [searchParams, router])

  // Load filter options (tipos)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    api<PaginatedResponse<TipoContrato>>('/tipos-contrato?limit=100', {
      token: session.accessToken,
    })
      .then((res) => setTipos(res.data ?? []))
      .catch(() => setTipos([]))
  }, [session?.accessToken, status])

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (search) sp.set('search', search)
    if (estado) sp.set('estado', estado)
    if (tipoId) sp.set('tipoId', tipoId)
    if (expiraEmDias) sp.set('expiraEmDias', expiraEmDias)
    sp.set('limit', '25')
    if (cursor) sp.set('cursor', cursor)
    return sp.toString()
  }, [search, estado, tipoId, expiraEmDias, cursor])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    api<PaginatedResponse<ContratoListItem>>(`/contratos?${query}`, {
      token: session.accessToken,
    })
      .then((res) => {
        if (cancelled) return
        setItems((prev) => (cursor ? [...prev, ...(res.data ?? [])] : res.data ?? []))
        setNextCursor(res.nextCursor)
        setTotal(res.total ?? 0)
        setError(null)
      })
      .catch((err: { error?: string }) => {
        if (!cancelled) setError(err?.error ?? 'Erro ao carregar contratos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query, session?.accessToken, status, cursor])

  // Reset cursor + items when filters change.
  useEffect(() => {
    setCursor(null)
    setItems([])
  }, [search, estado, tipoId, expiraEmDias])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Contratos</h1>
          <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
            {total.toLocaleString('pt-AO')} resultado(s)
          </p>
        </div>
        <Button leftIcon={<Plus size={14} />} onClick={() => setNovoOpen(true)}>
          Novo contrato
        </Button>
      </header>

      <NovoContratoModal open={novoOpen} onClose={() => setNovoOpen(false)} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) repeat(3, minmax(160px, 200px))',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--k2-text-mute)' }} />
          <Input
            placeholder="Procurar por título ou número…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos os estados</option>
          {Object.values(ContratoEstado).map((e) => (
            <option key={e} value={e}>
              {CONTRATO_ESTADO_LABELS[e]}
            </option>
          ))}
        </Select>
        <Select value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Select>
        <Select value={expiraEmDias} onChange={(e) => setExpiraEmDias(e.target.value)}>
          <option value="">Vencimento — qualquer</option>
          <option value="30">Expira ≤ 30 dias</option>
          <option value="60">Expira ≤ 60 dias</option>
          <option value="90">Expira ≤ 90 dias</option>
          <option value="180">Expira ≤ 180 dias</option>
        </Select>
      </div>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--k2-bg-elev-2)', color: 'var(--k2-text-dim)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <Th>Nº</Th>
              <Th>Título</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th>Data termo</Th>
              <Th>Contraparte</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--k2-text-mute)' }}>
                  Sem contratos.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--k2-border)' }}>
                <Td>
                  <Link href={`/contratos/${c.id}`} style={{ color: 'var(--k2-accent)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>
                    {c.numero ?? '—'}
                  </Link>
                </Td>
                <Td>
                  <Link href={`/contratos/${c.id}`} style={{ color: 'var(--k2-text)', textDecoration: 'none' }}>
                    {c.titulo}
                  </Link>
                </Td>
                <Td>{c.tipo?.nome ?? '—'}</Td>
                <Td>
                  <Badge variant={estadoBadgeVariant(c.estado)}>{estadoLabel(c.estado)}</Badge>
                </Td>
                <Td>{fmtDate(c.dataTermo)}</Td>
                <Td>{c.contrapartePrincipal?.nome ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {nextCursor && (
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => setCursor(nextCursor)}
          >
            Carregar mais
          </Button>
        )}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 14px' }}>{children}</td>
}
