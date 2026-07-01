'use client'

/**
 * Biblioteca → Legislação.
 *
 * Vista navegável dos diplomas em LegislationDocument — curados + os
 * ~1.200 diplomas importados (fonte='LEXAO'). Pesquisa por título/órgão,
 * filtros por órgão/ano/fonte, paginação por cursor, e detalhe com o
 * conteúdo + link para o original. Estes diplomas alimentam as citações
 * do Dr. Kamaia. ADMIN pode forçar/refrescar a importação.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Search, RefreshCw, Plus, Pencil } from 'lucide-react'
import type { Role } from '@kamaia/shared-types'
import { api } from '@/lib/api'
import { useTenants } from '@/hooks/use-tenants'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { fmtDate } from '@/lib/clm-format'

interface LegItem {
  id: string
  codigo: string | null
  titulo: string
  diploma: string
  orgao: string | null
  ano: number | null
  fonte: string // CURADO | LEXAO | código de regulador (CMC, …)
  publicacao: string | null
  url: string | null
}
interface LegDetail extends LegItem {
  conteudo: string | null
  emVigorDesde: string | null
  _count?: { chunks: number }
}
interface ListResp {
  data: LegItem[]
  nextCursor: string | null
  total: number
}

export default function LegislacaoPage() {
  const { data: session, status } = useSession()
  const { tenants } = useTenants()
  const searchParams = useSearchParams()
  const token = session?.accessToken

  const isAdmin = useMemo<boolean>(() => {
    if (typeof window === 'undefined') return false
    const id = window.localStorage.getItem('kamaia.activeTenantId')
    const t = tenants.find((x) => x.id === id)
    return (t?.role ?? null) === ('ADMIN' as Role)
  }, [tenants])

  const [q, setQ] = useState('')
  const [orgao, setOrgao] = useState('')
  const [ano, setAno] = useState('')
  const [fonte, setFonte] = useState<'all' | 'CURADO' | 'LEXAO'>('all')

  const [items, setItems] = useState<LegItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const buildQuery = useCallback(
    (c: string | null) => {
      const sp = new URLSearchParams()
      if (q) sp.set('q', q)
      if (orgao) sp.set('orgao', orgao)
      if (ano) sp.set('ano', ano)
      if (fonte !== 'all') sp.set('fonte', fonte)
      sp.set('limit', '40')
      if (c) sp.set('cursor', c)
      return sp.toString()
    },
    [q, orgao, ano, fonte],
  )

  // Carga inicial / refiltragem
  useEffect(() => {
    if (status !== 'authenticated' || !token) return
    let cancelled = false
    setLoading(true)
    api<ListResp>(`/legislacao?${buildQuery(null)}`, { token })
      .then((res) => {
        if (cancelled) return
        setItems(res.data ?? [])
        setCursor(res.nextCursor)
        setTotal(res.total)
        setErr(null)
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([])
          setErr((e as { error?: string })?.error ?? 'Erro a carregar a legislação.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [buildQuery, token, status, reloadKey])

  const loadMore = async () => {
    if (!cursor || !token) return
    setLoadingMore(true)
    try {
      const res = await api<ListResp>(`/legislacao?${buildQuery(cursor)}`, { token })
      setItems((prev) => [...prev, ...(res.data ?? [])])
      setCursor(res.nextCursor)
    } catch {
      /* mantém o que já está */
    } finally {
      setLoadingMore(false)
    }
  }

  // Detalhe
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<LegDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editandoTexto, setEditandoTexto] = useState(false)
  const [textoEdit, setTextoEdit] = useState('')
  const [savingTexto, setSavingTexto] = useState(false)
  const openDetail = useCallback(
    async (id: string) => {
      if (!token) return
      setDetailOpen(true)
      setDetail(null)
      setEditandoTexto(false)
      setDetailLoading(true)
      try {
        const d = await api<LegDetail>(`/legislacao/${id}`, { token })
        setDetail(d)
      } catch {
        setDetail(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [token],
  )

  // Deep-link: /biblioteca/legislacao?doc=<id> abre o diploma directo.
  // É como as citações clicáveis do Dr. Kamaia chegam ao texto do diploma.
  const docParam = searchParams.get('doc')
  useEffect(() => {
    if (docParam && token) void openDetail(docParam)
  }, [docParam, token, openDetail])
  const iniciarEdicao = () => {
    setTextoEdit(detail?.conteudo ?? '')
    setEditandoTexto(true)
  }
  const salvarTexto = async () => {
    if (!detail || !token) return
    setSavingTexto(true)
    try {
      const d = await api<LegDetail>(`/legislacao/${detail.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ conteudo: textoEdit }),
      })
      setDetail(d)
      setEditandoTexto(false)
    } catch {
      /* mantém o modo de edição para o utilizador tentar de novo */
    } finally {
      setSavingTexto(false)
    }
  }

  // Import (admin)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const triggerImport = async (mode: 'incremental' | 'reguladores' = 'incremental') => {
    if (!token) return
    setImporting(true)
    setImportMsg(null)
    try {
      const r = await api<{ ok: boolean; via?: string; estado: string }>(
        `/legislacao/importar?mode=${mode}`,
        { method: 'POST', token },
      )
      setImportMsg(
        r.estado === 'ja-a-correr'
          ? 'A importação já está a correr — aguarde e recarregue.'
          : `Importação iniciada${r.via === 'in-process' ? ' (em background)' : ''} — os diplomas vão aparecer nos próximos minutos. Recarregue para ver.`,
      )
    } catch {
      setImportMsg('Erro ao iniciar a importação.')
    } finally {
      setImporting(false)
    }
  }

  // Adicionar diploma (admin) — fiável, sem scraping
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    diploma: '',
    orgao: '',
    ano: '',
    publicacao: '',
    url: '',
    conteudo: '',
  })
  const setF =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))
  const submitAdd = async () => {
    if (!token) return
    if (form.titulo.trim().length < 2 || form.diploma.trim().length < 2) {
      setAddErr('Título e referência do diploma são obrigatórios.')
      return
    }
    setSaving(true)
    setAddErr(null)
    try {
      const body: Record<string, unknown> = {
        titulo: form.titulo.trim(),
        diploma: form.diploma.trim(),
        orgao: form.orgao.trim() || undefined,
        ano: form.ano ? Number(form.ano) : undefined,
        publicacao: form.publicacao || undefined,
        url: form.url.trim() || undefined,
        conteudo: form.conteudo.trim() || undefined,
      }
      await api('/legislacao', { method: 'POST', token, body: JSON.stringify(body) })
      setAddOpen(false)
      setForm({ titulo: '', diploma: '', orgao: '', ano: '', publicacao: '', url: '', conteudo: '' })
      setReloadKey((k) => k + 1)
    } catch (e) {
      setAddErr((e as { error?: string })?.error ?? 'Não foi possível guardar o diploma.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Legislação</h1>
          <p style={{ fontSize: 12, color: 'var(--k2-text-mute)', marginTop: 4 }}>
            {loading ? 'A carregar…' : `${total.toLocaleString('pt-PT')} diplomas`}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAddErr(null)
                setAddOpen(true)
              }}
              leftIcon={<Plus size={13} />}
            >
              Adicionar diploma
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => triggerImport('reguladores')}
              loading={importing}
              leftIcon={<RefreshCw size={13} />}
            >
              Importar reguladores
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => triggerImport('incremental')}
              loading={importing}
              leftIcon={<RefreshCw size={13} />}
            >
              Importar legislação
            </Button>
          </div>
        )}
      </header>

      {importMsg && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--k2-text-dim)',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            padding: '10px 12px',
          }}
        >
          {importMsg}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--k2-text-mute)',
              pointerEvents: 'none',
            }}
          />
          <Input
            placeholder="Pesquisar título, diploma ou órgão…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Input
          placeholder="Órgão (ex: BNA)"
          value={orgao}
          onChange={(e) => setOrgao(e.target.value)}
          style={{ width: 170 }}
        />
        <Input
          type="number"
          placeholder="Ano"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          style={{ width: 100 }}
        />
        <Select
          value={fonte}
          onChange={(e) => setFonte(e.target.value as 'all' | 'CURADO' | 'LEXAO')}
          style={{ width: 140 }}
        >
          <option value="all">Todas as fontes</option>
          <option value="LEXAO">Importada</option>
          <option value="CURADO">Curada</option>
        </Select>
      </div>

      {err && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--k2-bad)',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            padding: '10px 12px',
          }}
        >
          {err}
        </div>
      )}

      {!loading && !err && items.length === 0 && (
        <div
          style={{
            background: 'var(--k2-bg-elev)',
            border: '1px dashed var(--k2-border)',
            borderRadius: 'var(--k2-radius)',
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--k2-text-mute)',
            fontSize: 13,
          }}
        >
          Sem diplomas a mostrar.
          {isAdmin
            ? ' Use “Importar legislação” para carregar a legislação angolana.'
            : ' A legislação está a ser carregada — volte daqui a pouco.'}
        </div>
      )}

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => openDetail(it.id)}
            style={{
              textAlign: 'left',
              padding: 14,
              background: 'var(--k2-bg-elev)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius)',
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{it.titulo}</span>
              <Badge variant={fonteVariant(it.fonte)}>{fonteLabel(it.fonte)}</Badge>
              {it.orgao && <Badge variant="default">{it.orgao}</Badge>}
              {it.ano != null && (
                <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{it.ano}</span>
              )}
            </div>
            {it.diploma && (
              <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 6 }}>
                {it.diploma}
              </div>
            )}
          </button>
        ))}
      </div>

      {cursor && (
        <Button
          variant="secondary"
          onClick={loadMore}
          loading={loadingMore}
          style={{ alignSelf: 'center' }}
        >
          Carregar mais
        </Button>
      )}

      {/* Detalhe — painel lateral com o texto transcrito do diploma */}
      <Drawer open={detailOpen} onClose={() => setDetailOpen(false)} width={680} position="right">
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {detailLoading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}
          {!detailLoading && detail && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge variant={fonteVariant(detail.fonte)}>{fonteLabel(detail.fonte)}</Badge>
                {detail.orgao && <Badge variant="default">{detail.orgao}</Badge>}
                {detail.ano != null && (
                  <span style={{ fontSize: 12, color: 'var(--k2-text-mute)' }}>{detail.ano}</span>
                )}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{detail.titulo}</h2>
              <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>{detail.diploma}</div>
              {detail.publicacao && (
                <div style={{ fontSize: 12, color: 'var(--k2-text-mute)' }}>
                  Publicação: {fmtDate(detail.publicacao)}
                </div>
              )}
              {editandoTexto ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Textarea
                    value={textoEdit}
                    onChange={(e) => setTextoEdit(e.target.value)}
                    rows={22}
                    placeholder="Cole aqui o texto OFICIAL do diploma (do Diário da República ou do regulador). Não invente — cole a fonte autêntica."
                    style={{ resize: 'vertical', fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button variant="ghost" type="button" onClick={() => setEditandoTexto(false)} disabled={savingTexto}>
                      Cancelar
                    </Button>
                    <Button variant="primary" type="button" onClick={salvarTexto} loading={savingTexto}>
                      Guardar transcrição
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isAdmin && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" type="button" onClick={iniciarEdicao} leftIcon={<Pencil size={13} />}>
                        {detail.conteudo ? 'Editar texto' : 'Transcrever'}
                      </Button>
                    </div>
                  )}
                  {detail.conteudo ? (
                    <pre
                      style={{
                        marginTop: 2,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        fontFamily: 'inherit',
                        color: 'var(--k2-text)',
                        margin: 0,
                      }}
                    >
                      {detail.conteudo}
                    </pre>
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--k2-text-mute)',
                        background: 'var(--k2-bg-elev)',
                        border: '1px dashed var(--k2-border)',
                        borderRadius: 'var(--k2-radius-sm)',
                        padding: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      Texto integral por transcrever. Carregue em
                      <strong> Transcrever</strong> e cole o articulado oficial —
                      o Dr. Kamaia passa a citá-lo.
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {!detailLoading && !detail && (
            <div style={{ color: 'var(--k2-text-mute)' }}>Não foi possível carregar o diploma.</div>
          )}
        </div>
      </Drawer>

      {/* Adicionar diploma (admin) */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} width={620}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Adicionar diploma</h2>
          <p style={{ fontSize: 12, color: 'var(--k2-text-mute)', margin: 0 }}>
            Acrescente um diploma à biblioteca de legislação. Cole o texto
            integral para o Dr. Kamaia o poder citar.
          </p>

          {addErr && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--k2-bad)',
                background: 'var(--k2-bg-elev)',
                border: '1px solid var(--k2-border)',
                borderRadius: 'var(--k2-radius-sm)',
                padding: '10px 12px',
              }}
            >
              {addErr}
            </div>
          )}

          <Field label="Título *">
            <Input value={form.titulo} onChange={setF('titulo')} placeholder="Ex: Regime Jurídico das Sociedades Seguradoras" />
          </Field>
          <Field label="Referência do diploma *">
            <Input value={form.diploma} onChange={setF('diploma')} placeholder="Ex: Lei n.º 14/21, de 19 de Maio" />
          </Field>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Órgão" style={{ flex: 1, minWidth: 180 }}>
              <Input value={form.orgao} onChange={setF('orgao')} placeholder="Ex: ARSEG" />
            </Field>
            <Field label="Ano" style={{ width: 110 }}>
              <Input type="number" value={form.ano} onChange={setF('ano')} placeholder="2021" />
            </Field>
            <Field label="Publicação" style={{ width: 160 }}>
              <Input type="date" value={form.publicacao} onChange={setF('publicacao')} />
            </Field>
          </div>
          <Field label="Link ao original (opcional)">
            <Input value={form.url} onChange={setF('url')} placeholder="https://…" />
          </Field>
          <Field label="Texto do diploma (opcional — alimenta o Dr. Kamaia)">
            <Textarea
              value={form.conteudo}
              onChange={setF('conteudo')}
              rows={8}
              placeholder="Cole aqui o articulado do diploma…"
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submitAdd} loading={saving}>
              Guardar diploma
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}

function fonteLabel(f: string): string {
  if (f === 'LEXAO') return 'Importada'
  if (f === 'CURADO') return 'Curada'
  return f
}
function fonteVariant(f: string): string {
  if (f === 'LEXAO') return 'info'
  if (f === 'CURADO') return 'success'
  return 'warning'
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span
        style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--k2-text-mute)',
          marginBottom: 5,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
