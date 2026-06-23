'use client'

/**
 * Kamaia CLM — Biblioteca de cláusulas.
 *
 * Lista cláusulas aprovadas e (para ADMIN/LEGAL_LEAD) pendentes.
 *
 * Backend (audit fix anterior): role-aware via TenantContext —
 * BUSINESS_USER/VIEWER só vê aprovadas mesmo passando
 * ?includeUnapproved=1. ADMIN/LEGAL_LEAD vê pendentes para revisão.
 *
 * Aprovação: PATCH /clausulas/:id/approve (ADMIN/LEGAL_LEAD only).
 * Edição: PATCH /clausulas/:id.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Check, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTenants } from '@/hooks/use-tenants'
import type { Role } from '@kamaia/shared-types'

interface Clausula {
  id: string
  titulo: string
  conteudo: string
  categoria: string | null
  tags: string[]
  tipoContratoCodigos: string[]
  isApproved: boolean
  usoCount: number
}

interface ListResponse {
  data: Clausula[]
  nextCursor: string | null
}

type Tab = 'aprovadas' | 'pendentes'

const APPROVER_ROLES: Role[] = ['ADMIN', 'LEGAL_LEAD'] as Role[]

export default function ClausulasPage() {
  const { data: session, status } = useSession()
  const { tenants } = useTenants()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('aprovadas')
  const [items, setItems] = useState<Clausula[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Detecta se utilizador actual tem permissão para aprovar
  const activeRole = useMemo<Role | null>(() => {
    if (typeof window === 'undefined') return null
    const id = window.localStorage.getItem('kamaia.activeTenantId')
    const t = tenants.find((x) => x.id === id)
    return t?.role ?? null
  }, [tenants])
  const canApprove = activeRole !== null && APPROVER_ROLES.includes(activeRole)

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    sp.set('limit', '50')
    if (tab === 'pendentes') sp.set('includeUnapproved', 'true')
    return sp.toString()
  }, [search, tab])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    api<ListResponse>(`/clausulas?${query}`, { token: session.accessToken })
      .then((res) => {
        if (cancelled) return
        const list = res.data ?? []
        // Cliente filtra adicional pelo tab — server pode devolver
        // mistura quando includeUnapproved=true
        const filtered =
          tab === 'pendentes' ? list.filter((c) => !c.isApproved) : list
        setItems(filtered)
        setErr(null)
      })
      .catch((e) => {
        if (!cancelled) setErr((e as { error?: string })?.error ?? 'Erro a carregar')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, session?.accessToken, status, refreshCounter, tab])

  const approve = async (id: string) => {
    if (!session?.accessToken) return
    try {
      await api(`/clausulas/${id}/approve`, {
        method: 'PATCH',
        token: session.accessToken,
      })
      setRefreshCounter((c) => c + 1)
    } catch (e) {
      alert((e as { error?: string })?.error ?? 'Erro ao aprovar')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Cláusulas</h1>
        <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
          Biblioteca reutilizável. Cláusulas aprovadas entram no contexto da IA ao redigir contratos.
        </p>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--k2-border)' }}>
        <TabBtn active={tab === 'aprovadas'} onClick={() => setTab('aprovadas')}>
          Aprovadas
        </TabBtn>
        {canApprove && (
          <TabBtn active={tab === 'pendentes'} onClick={() => setTab('pendentes')}>
            Pendentes
          </TabBtn>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--k2-text-mute)' }} />
        <Input
          placeholder="Procurar por título ou conteúdo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {err && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {err}
        </div>
      )}

      {loading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}

      {!loading && items.length === 0 && (
        <div style={{ background: 'var(--k2-bg-elev)', border: '1px dashed var(--k2-border)', borderRadius: 'var(--k2-radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--k2-text-mute)', fontSize: 13 }}>
          {tab === 'pendentes'
            ? 'Sem cláusulas pendentes de aprovação.'
            : 'Sem cláusulas na biblioteca. Cria a partir do editor do contrato (selecciona texto → Salvar cláusula).'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((c) => (
          <ClausulaCard
            key={c.id}
            clausula={c}
            canApprove={canApprove}
            onApprove={() => approve(c.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--k2-accent)' : '2px solid transparent',
        color: active ? 'var(--k2-text)' : 'var(--k2-text-dim)',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function ClausulaCard({
  clausula,
  canApprove,
  onApprove,
}: {
  clausula: Clausula
  canApprove: boolean
  onApprove: () => void
}) {
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>{clausula.titulo}</span>
            {clausula.isApproved ? (
              <Badge variant="success">Aprovada</Badge>
            ) : (
              <Badge variant="warning">Pendente</Badge>
            )}
            {clausula.categoria && <Badge variant="info">{clausula.categoria}</Badge>}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {clausula.tipoContratoCodigos.length > 0 ? (
              clausula.tipoContratoCodigos.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'var(--k2-bg-elev-2, var(--k2-bg-elev))',
                    color: 'var(--k2-text-mute)',
                    border: '1px solid var(--k2-border)',
                  }}
                >
                  {t}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 10, color: 'var(--k2-text-mute)' }}>
                Aplicável a qualquer tipo (transversal)
              </span>
            )}
            {clausula.tags.map((t) => (
              <Badge key={t} variant="default">{t}</Badge>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 4 }}>
            Usada {clausula.usoCount} vez(es)
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          {!clausula.isApproved && canApprove && (
            <Button
              variant="secondary"
              onClick={onApprove}
              leftIcon={<Check size={12} />}
              title="Aprovar para entrar na biblioteca (passa a ser usada pela IA no drafting)"
            >
              Aprovar
            </Button>
          )}
        </div>
      </div>

      <pre
        style={{
          fontSize: 12,
          color: 'var(--k2-text-dim)',
          marginTop: 10,
          padding: 10,
          background: 'var(--k2-bg, transparent)',
          borderRadius: 'var(--k2-radius-sm)',
          border: '1px solid var(--k2-border)',
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          maxHeight: 240,
          overflow: 'auto',
        }}
      >
        {clausula.conteudo}
      </pre>
    </div>
  )
}
