'use client'

/**
 * Kamaia CLM — Entidades list.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Plus, Search } from 'lucide-react'
import {
  EntidadeTipo,
  EntidadeNacionalidadeCambial,
  PaginatedResponse,
} from '@kamaia/shared-types'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BulkImportDrawer } from '@/components/entidades/bulk-import-drawer'
import { EntidadeFormDrawer } from '@/components/entidades/entidade-form-drawer'

interface Entidade {
  id: string
  nome: string
  tipo: EntidadeTipo
  nacionalidadeCambial: EntidadeNacionalidadeCambial
  nif: string | null
  email: string | null
}

export default function EntidadesPage() {
  const { data: session, status } = useSession()
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('')
  const [residencia, setResidencia] = useState('')
  const [items, setItems] = useState<Entidade[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  /**
   * Counter para forçar refetch após criar/importar — incrementar
   * `refreshKey` re-corre o useEffect mesmo quando os filtros não
   * mudaram. Resolve o bug "criar não aparece" (que era afinal a
   * lista a não refrescar quando o user deixava cursor=null e
   * filtros vazios).
   */
  const [refreshKey, setRefreshKey] = useState(0)

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (search) sp.set('search', search)
    if (tipo) sp.set('tipo', tipo)
    if (residencia) sp.set('nacionalidadeCambial', residencia)
    sp.set('limit', '25')
    if (cursor) sp.set('cursor', cursor)
    return sp.toString()
  }, [search, tipo, residencia, cursor])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    api<PaginatedResponse<Entidade>>(`/entidades?${query}`, { token: session.accessToken })
      .then((res) => {
        if (cancelled) return
        setItems((prev) => (cursor ? [...prev, ...(res.data ?? [])] : res.data ?? []))
        setNextCursor(res.nextCursor)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, session?.accessToken, status, cursor, refreshKey])

  useEffect(() => {
    setCursor(null)
    setItems([])
  }, [search, tipo, residencia])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Entidades</h1>
        </div>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => setShowBulkImport(true)}>
            Importar CSV
          </Button>
          <Button leftIcon={<Plus size={14} />} onClick={() => setShowQuickCreate(true)}>
            Nova entidade
          </Button>
        </div>
      </header>

      <BulkImportDrawer
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onDone={() => {
          setShowBulkImport(false)
          setCursor(null)
          setItems([])
          setRefreshKey((k) => k + 1)
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) repeat(2, minmax(160px, 200px))', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--k2-text-mute)' }} />
          <Input placeholder="Procurar…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value={EntidadeTipo.PESSOA_SINGULAR}>Pessoa singular</option>
          <option value={EntidadeTipo.PESSOA_COLECTIVA}>Pessoa colectiva</option>
        </Select>
        <Select value={residencia} onChange={(e) => setResidencia(e.target.value)}>
          <option value="">Residente / não-residente</option>
          <option value={EntidadeNacionalidadeCambial.RESIDENTE}>Residente</option>
          <option value={EntidadeNacionalidadeCambial.NAO_RESIDENTE}>Não-residente</option>
        </Select>
      </div>

      <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--k2-bg-elev-2)', color: 'var(--k2-text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>Nome</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>Tipo</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>Residência</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>NIF</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--k2-text-mute)' }}>
                  Sem entidades.
                </td>
              </tr>
            )}
            {items.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--k2-border)' }}>
                <td style={{ padding: '12px 14px' }}>
                  <Link href={`/entidades/${e.id}`} style={{ color: 'var(--k2-text)', textDecoration: 'none' }}>{e.nome}</Link>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <Badge variant="default">{e.tipo === EntidadeTipo.PESSOA_SINGULAR ? 'Singular' : 'Colectiva'}</Badge>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <Badge variant={e.nacionalidadeCambial === EntidadeNacionalidadeCambial.NAO_RESIDENTE ? 'warning' : 'default'}>
                    {e.nacionalidadeCambial === EntidadeNacionalidadeCambial.NAO_RESIDENTE ? 'Não-residente' : 'Residente'}
                  </Badge>
                </td>
                <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums', color: 'var(--k2-text-dim)' }}>{e.nif ?? '—'}</td>
                <td style={{ padding: '12px 14px', color: 'var(--k2-text-dim)' }}>{e.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" loading={loading} onClick={() => setCursor(nextCursor)}>Carregar mais</Button>
        </div>
      )}

      <EntidadeFormDrawer
        open={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onCreated={() => {
          // AUDIT fix do bug "criar não aparece": refetch explícito
          // em vez de optimistic insert. Mais fiável quando há
          // filtros activos na lista (e.g. utilizador filtra por
          // Não-residente, cria um Residente — o optimistic ia
          // mostrar mas o refetch real iria escondê-lo, criando
          // inconsistência confusa).
          setShowQuickCreate(false)
          setCursor(null)
          setItems([])
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
