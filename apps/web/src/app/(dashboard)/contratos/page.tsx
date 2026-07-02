'use client'

/**
 * Kamaia CLM — Contratos list.
 *
 * Cursor-based pagination + filters (estado, tipo, expiraEmDias, search).
 */

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { Download, Loader2, Plus, Search, Upload } from 'lucide-react'
import {
  ContratoEstado,
  ContratoOrigem,
  CONTRATO_ESTADO_LABELS,
  CONTRATOS_HERANCA_FIRST,
  PaginatedResponse,
} from '@kamaia/shared-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { estadoBadgeVariant, estadoLabel, fmtDate } from '@/lib/clm-format'
import { NovoContratoFlow } from '@/components/contratos/novo-contrato-flow'
import { ImportarCarteiraDrawer } from '@/components/contratos/importar-carteira-drawer'

// Alinha com o retorno real de GET /contratos (contratos.service list):
// o campo é `numeroInterno` (não `numero`) e a contraparte vem em
// `partes[0].entidade` (primeira parte por ordem).
interface ContratoListItem {
  id: string
  numeroInterno: string | null
  titulo: string
  estado: ContratoEstado
  origem: ContratoOrigem
  dataTermo: string | null
  tipo: { id: string; nome: string } | null
  partes: { entidade: { id: string; nome: string } | null }[]
}

interface TipoContrato {
  id: string
  nome: string
}

/**
 * Wrapper Suspense — exigido pelo Next 14 App Router porque
 * `useSearchParams()` é usado no inner form. Sem isto o `next build`
 * falha em prerender com "missing-suspense-with-csr-bailout".
 */
export default function ContratosListPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
          <Loader2 size={22} color="var(--k2-text-mute)" className="animate-spin" />
        </div>
      }
    >
      <ContratosListInner />
    </Suspense>
  )
}

function ContratosListInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<string>('')
  const [origem, setOrigem] = useState<string>('')
  const [tipoId, setTipoId] = useState<string>('')
  const [expiraEmDias, setExpiraEmDias] = useState<string>('')

  const [items, setItems] = useState<ContratoListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  // Força refetch da página 1 (ex.: ao voltar à lista depois de criar).
  const [refreshKey, setRefreshKey] = useState(0)
  // Guard de corrida: descarta respostas tardias de páginas/filtros antigos.
  const reqIdRef = useRef(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tipos, setTipos] = useState<TipoContrato[]>([])
  const [novoOpen, setNovoOpen] = useState(false)
  const [importCarteiraOpen, setImportCarteiraOpen] = useState(false)
  // Quando true, o modal abre directo no caminho ① (registar
  // contrato existente — equivalente a "Importar 1 ficheiro").
  const [importarMode, setImportarMode] = useState(false)
  // Entidade pré-preenchida como parte (vindo de /entidades/[id]).
  const [presetParte, setPresetParte] = useState<
    { entidadeId: string; entidadeNome: string } | undefined
  >(undefined)

  // Auto-abre modal quando vier de /contratos/novo (que faz redirect)
  // ou de qualquer link com `?novo=1`. Limpa query string a seguir.
  // `?onboard=import` (Sprint 4.3, vindo do FirstRunBanner) abre
  // directo no caminho de "registar contrato existente" — a
  // primeira jornada típica de quem traz carteira herdada.
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      const entidadeId = searchParams.get('parteEntidade')
      const entidadeNome = searchParams.get('parteNome')
      if (entidadeId && entidadeNome) {
        setPresetParte({ entidadeId, entidadeNome })
      }
      setNovoOpen(true)
      router.replace('/contratos')
    } else if (searchParams.get('onboard') === 'import') {
      setImportarMode(true)
      setNovoOpen(true)
      router.replace('/contratos')
    }
  }, [searchParams, router])

  // Load filter options (tipos)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    // Endpoint não pagina (devolve array directo). Helper defensivo
     // garante que aceitamos ambas as formas sem assumir.
    api<unknown>('/tipos-contrato', {
      token: session.accessToken,
    })
      .then((res) => setTipos(unwrapList<TipoContrato>(res)))
      .catch(() => setTipos([]))
  }, [session?.accessToken, status])

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (estado) sp.set('estado', estado)
    if (origem) sp.set('origem', origem)
    if (tipoId) sp.set('tipoId', tipoId)
    if (expiraEmDias) sp.set('expiraEm', expiraEmDias)
    sp.set('limit', '25')
    if (cursor) sp.set('cursor', cursor)
    return sp.toString()
  }, [search, estado, origem, tipoId, expiraEmDias, cursor])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    const myId = ++reqIdRef.current
    setLoading(true)
    api<PaginatedResponse<ContratoListItem>>(`/contratos?${query}`, {
      token: session.accessToken,
    })
      .then((res) => {
        if (reqIdRef.current !== myId) return
        // `cursor` na closure decide append vs replace; o guard de id
        // garante que só a resposta mais recente aplica estado, por
        // isso uma página antiga nunca contamina uma lista já reposta.
        setItems((prev) => (cursor ? [...prev, ...(res.data ?? [])] : res.data ?? []))
        setNextCursor(res.nextCursor)
        setError(null)
      })
      .catch((err: { error?: string }) => {
        if (reqIdRef.current !== myId) return
        setError(err?.error ?? 'Erro ao carregar contratos')
      })
      .finally(() => {
        if (reqIdRef.current === myId) setLoading(false)
      })
  }, [query, session?.accessToken, status, cursor, refreshKey])

  // Reset cursor + items when filters change.
  useEffect(() => {
    setCursor(null)
    setItems([])
  }, [search, estado, origem, tipoId, expiraEmDias])

  // Refetch da página 1 quando a janela volta a ganhar foco — apanha
  // contratos criados/alterados noutra vista sem reload manual.
  useEffect(() => {
    const onFocus = () => {
      setCursor(null)
      setRefreshKey((k) => k + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Contratos</h1>
        </div>
        {/* Importação consolidada aqui (sidebar removido).
            "Importar" abre o flow de novo contrato directamente
            no caminho ① (registar existente — equivalente a
            "1 ficheiro"). Para massa, link no path selector. */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            leftIcon={<Upload size={14} />}
            onClick={() => setImportCarteiraOpen(true)}
          >
            Importar carteira
          </Button>
          <Button
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setImportarMode(false)
              setNovoOpen(true)
            }}
          >
            {CONTRATOS_HERANCA_FIRST ? 'Adicionar contrato' : 'Novo contrato'}
          </Button>
        </div>
      </header>

      <NovoContratoFlow
        open={novoOpen}
        onClose={() => {
          setNovoOpen(false)
          setImportarMode(false)
          setPresetParte(undefined)
        }}
        presetCaminho={CONTRATOS_HERANCA_FIRST || importarMode ? 'existente' : undefined}
        presetParte={presetParte}
      />

      <ImportarCarteiraDrawer
        open={importCarteiraOpen}
        onClose={() => setImportCarteiraOpen(false)}
        onDone={() => {
          setCursor(null)
          setRefreshKey((k) => k + 1)
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 1fr) repeat(4, minmax(150px, 190px))',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--k2-text-mute)' }} />
          <Input
            aria-label="Procurar contratos"
            placeholder="Procurar por título ou número…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos os estados</option>
          {Object.values(ContratoEstado).map((e) => (
            <option key={e} value={e}>
              {CONTRATO_ESTADO_LABELS[e]}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Criados e herdados</option>
          <option value={ContratoOrigem.IMPORTADO_REPOSITORIO}>Herdados</option>
          <option value={ContratoOrigem.CRIADO_INTERNAMENTE}>Criados de raiz</option>
        </Select>
        <Select aria-label="Filtrar por tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por vencimento" value={expiraEmDias} onChange={(e) => setExpiraEmDias(e.target.value)}>
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
              <Th>Origem</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && loading && (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--k2-text-mute)' }}>
                  A carregar…
                </td>
              </tr>
            )}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--k2-text-mute)' }}>
                  Sem contratos.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--k2-border)' }}>
                <Td>
                  <Link href={`/contratos/${c.id}`} style={{ color: 'var(--k2-accent)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>
                    {c.numeroInterno ?? '—'}
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
                <Td>{c.partes?.[0]?.entidade?.nome ?? '—'}</Td>
                <Td><OrigemBadge origem={c.origem} /></Td>
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

/**
 * Distingue as duas portas de entrada: contrato criado de raiz (＋) vs.
 * herdado / importado (↓). Iguala visualmente a herança à criação.
 */
function OrigemBadge({ origem }: { origem: ContratoOrigem }) {
  const herdado = origem === ContratoOrigem.IMPORTADO_REPOSITORIO
  return (
    <span
      title={herdado ? 'Herdado' : 'Criado de raiz'}
      aria-label={herdado ? 'Herdado' : 'Criado de raiz'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 7,
        background: 'var(--k2-bg-elev-2)',
        border: '1px solid var(--k2-border)',
        color: herdado ? 'var(--k2-accent)' : 'var(--k2-text-mute)',
      }}
    >
      {herdado ? <Download size={13} /> : <Plus size={13} />}
    </span>
  )
}
