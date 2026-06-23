'use client'

/**
 * Kamaia CLM — Entidade detail page.
 *
 * Dados principais + contactos (CRUD inline) + KYC (lista + add) +
 * contratos onde a entidade participa. Botão de merge para fusão
 * com outra entidade.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ChevronLeft, Plus, Trash2, GitMerge, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import {
  EntidadeTipo,
  EntidadeNacionalidadeCambial,
  ContratoEstado,
} from '@kamaia/shared-types'
import { estadoBadgeVariant, estadoLabel, fmtDate, fmtMoney } from '@/lib/clm-format'

interface Entidade {
  id: string
  nome: string
  nomeComercial: string | null
  tipo: EntidadeTipo
  nacionalidadeCambial: EntidadeNacionalidadeCambial
  nif: string | null
  numeroBI: string | null
  matriculaRC: string | null
  isInstituicaoFinanceira: boolean
  sectorActividade: string | null
  paisResidencia: string | null
  observacoes: string | null
  _count: { partesEmContratos: number }
}

interface Contacto {
  id: string
  nome: string
  cargo: string | null
  email: string | null
  telefone: string | null
  isPrincipal: boolean
}

interface KycDoc {
  id: string
  tipo: string
  numero: string | null
  emitidoEm: string | null
  validoAte: string | null
  documentId: string | null
  observacoes: string | null
}

interface ContratoMin {
  papel: string
  contrato: {
    id: string
    numeroInterno: string
    titulo: string
    estado: ContratoEstado
    dataTermo: string | null
    valor: string | null
    moeda: string | null
    tipo: { nome: string } | null
  }
}

const KYC_TIPOS = [
  'CERTIDAO_COMERCIAL',
  'CERTIDAO_PERMANENTE',
  'BI',
  'PASSAPORTE',
  'PROCURACAO',
  'NIF_AGT',
  'ACTA_ORGAOS',
  'PACTO_SOCIAL',
  'AML_REPORT',
  'BENEFICIARIO_EFECTIVO',
  'OUTRO',
]

export default function EntidadeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()

  const [entidade, setEntidade] = useState<Entidade | null>(null)
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [kyc, setKyc] = useState<KycDoc[]>([])
  const [contratos, setContratos] = useState<ContratoMin[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [contactoOpen, setContactoOpen] = useState(false)
  const [kycOpen, setKycOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  const fetchAll = async () => {
    if (!session?.accessToken || !id) return
    setLoading(true)
    try {
      const [e, c, k, ct] = await Promise.all([
        api<Entidade>(`/entidades/${id}`, { token: session.accessToken }),
        api<Contacto[]>(`/entidades/${id}/contactos`, { token: session.accessToken }),
        api<KycDoc[]>(`/entidades/${id}/kyc`, { token: session.accessToken }),
        api<ContratoMin[]>(`/entidades/${id}/contratos`, { token: session.accessToken }),
      ])
      setEntidade(e)
      setContactos(c ?? [])
      setKyc(k ?? [])
      setContratos(ct ?? [])
      setErr(null)
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro a carregar entidade')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.accessToken])

  const removeContacto = async (cid: string) => {
    if (!session?.accessToken) return
    if (!confirm('Remover este contacto?')) return
    await api(`/entidades/${id}/contactos/${cid}`, {
      method: 'DELETE',
      token: session.accessToken,
    })
    void fetchAll()
  }

  const removeKyc = async (kid: string) => {
    if (!session?.accessToken) return
    if (!confirm('Remover este documento KYC?')) return
    await api(`/entidades/${id}/kyc/${kid}`, {
      method: 'DELETE',
      token: session.accessToken,
    })
    void fetchAll()
  }

  if (loading) return <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>
  if (err) return <div style={{ color: 'var(--k2-bad)' }}>{err}</div>
  if (!entidade) return <div style={{ color: 'var(--k2-text-mute)' }}>Sem dados.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/entidades" style={{ color: 'var(--k2-text-dim)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={12} /> Entidades
      </Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{entidade.nome}</h1>
          {entidade.nomeComercial && (
            <p style={{ fontSize: 13, color: 'var(--k2-text-dim)', marginTop: 4 }}>
              também conhecida como “{entidade.nomeComercial}”
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Badge variant="default">
              {entidade.tipo === EntidadeTipo.PESSOA_SINGULAR ? 'Singular' : 'Colectiva'}
            </Badge>
            <Badge variant={entidade.nacionalidadeCambial === EntidadeNacionalidadeCambial.NAO_RESIDENTE ? 'warning' : 'default'}>
              {entidade.nacionalidadeCambial === EntidadeNacionalidadeCambial.NAO_RESIDENTE ? 'Não-residente' : 'Residente'}
            </Badge>
            {entidade.isInstituicaoFinanceira && (
              <Badge variant="info">Instituição financeira</Badge>
            )}
            <Badge variant="default">{entidade._count.partesEmContratos} contrato(s)</Badge>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setMergeOpen(true)} leftIcon={<GitMerge size={13} />}>
          Mesclar com outra
        </Button>
      </header>

      <Section title="Dados">
        <Grid>
          <Info label="NIF" value={entidade.nif} />
          <Info label="Número BI" value={entidade.numeroBI} />
          <Info label="Matrícula RC" value={entidade.matriculaRC} />
          <Info label="Sector" value={entidade.sectorActividade} />
          <Info label="País" value={entidade.paisResidencia} />
        </Grid>
        {entidade.observacoes && (
          <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 8, padding: 10, background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)' }}>
            {entidade.observacoes}
          </div>
        )}
      </Section>

      <Section
        title="Contactos"
        action={
          <Button variant="secondary" leftIcon={<Plus size={12} />} onClick={() => setContactoOpen(true)}>
            Adicionar contacto
          </Button>
        }
      >
        {contactos.length === 0 ? (
          <Muted>Sem contactos registados.</Muted>
        ) : (
          <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
            {contactos.map((c) => (
              <div key={c.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{c.nome}</span>
                    {c.isPrincipal && <Badge variant="success">Principal</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>
                    {[c.cargo, c.email, c.telefone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button onClick={() => void removeContacto(c.id)} style={trashBtn}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Documentos KYC / AML"
        action={
          <Button variant="secondary" leftIcon={<Plus size={12} />} onClick={() => setKycOpen(true)}>
            Adicionar documento
          </Button>
        }
      >
        {kyc.length === 0 ? (
          <Muted>Sem documentos KYC.</Muted>
        ) : (
          <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
            {kyc.map((k) => (
              <div key={k.id} style={rowStyle}>
                <FileText size={14} color="var(--k2-text-mute)" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{k.tipo.replaceAll('_', ' ')}</span>
                    {k.numero && <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>n.º {k.numero}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>
                    {k.emitidoEm && `Emitido: ${fmtDate(k.emitidoEm)}`}
                    {k.validoAte && ` · Válido até: ${fmtDate(k.validoAte)}`}
                  </div>
                </div>
                <button onClick={() => void removeKyc(k.id)} style={trashBtn}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Contratos onde aparece">
        {contratos.length === 0 ? (
          <Muted>Esta entidade não está em nenhum contrato.</Muted>
        ) : (
          <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
            {contratos.map(({ papel, contrato: c }) => (
              <Link key={c.id} href={`/contratos/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--k2-border)', textDecoration: 'none', color: 'var(--k2-text)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {c.numeroInterno} · {c.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 2 }}>
                    {c.tipo?.nome ?? '—'} · {papel.replaceAll('_', ' ').toLowerCase()}
                    {c.dataTermo && ` · termo ${fmtDate(c.dataTermo)}`}
                    {c.valor && ` · ${fmtMoney(c.valor, c.moeda ?? undefined)}`}
                  </div>
                </div>
                <Badge variant={estadoBadgeVariant(c.estado)}>{estadoLabel(c.estado)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Drawers */}
      <NovoContactoDrawer
        open={contactoOpen}
        onClose={() => setContactoOpen(false)}
        entidadeId={String(id)}
        onDone={async () => { setContactoOpen(false); await fetchAll() }}
      />
      <NovoKycDrawer
        open={kycOpen}
        onClose={() => setKycOpen(false)}
        entidadeId={String(id)}
        onDone={async () => { setKycOpen(false); await fetchAll() }}
      />
      <MergeDrawer
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        targetId={String(id)}
        targetNome={entidade.nome}
        onDone={() => { window.location.href = '/entidades' }}
      />
    </div>
  )
}

// ─── Drawers ──────────────────────────────────────

function NovoContactoDrawer({ open, onClose, entidadeId, onDone }: { open: boolean; onClose: () => void; entidadeId: string; onDone: () => void }) {
  const { data: session } = useSession()
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { if (!open) { setNome(''); setCargo(''); setEmail(''); setTelefone(''); setIsPrincipal(false); setErr(null) } }, [open])

  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true); setErr(null)
    try {
      await api(`/entidades/${entidadeId}/contactos`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          nome: nome.trim(),
          cargo: cargo.trim() || undefined,
          email: email.trim() || undefined,
          telefone: telefone.trim() || undefined,
          isPrincipal,
        }),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro')
    } finally { setSubmitting(false) }
  }

  return (
    <Drawer open={open} onClose={onClose} width={480}>
      <DrawerHeader title="Novo contacto" onClose={onClose} />
      <DrawerBody>
        {err && <div style={errBoxStyle}>{err}</div>}
        <form id="c-form" onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 12 }}>
          <Field label="Nome *"><Input required value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
          <Field label="Cargo"><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
          <label style={{ display: 'inline-flex', gap: 8, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            <input type="checkbox" checked={isPrincipal} onChange={(e) => setIsPrincipal(e.target.checked)} />
            Marcar como contacto principal
          </label>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="c-form" loading={submitting}>Criar</Button>
      </DrawerFooter>
    </Drawer>
  )
}

function NovoKycDrawer({ open, onClose, entidadeId, onDone }: { open: boolean; onClose: () => void; entidadeId: string; onDone: () => void }) {
  const { data: session } = useSession()
  const [tipo, setTipo] = useState('CERTIDAO_COMERCIAL')
  const [numero, setNumero] = useState('')
  const [emitidoEm, setEmitidoEm] = useState('')
  const [validoAte, setValidoAte] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { if (!open) { setTipo('CERTIDAO_COMERCIAL'); setNumero(''); setEmitidoEm(''); setValidoAte(''); setObservacoes(''); setErr(null) } }, [open])

  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true); setErr(null)
    try {
      await api(`/entidades/${entidadeId}/kyc`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          tipo,
          numero: numero.trim() || undefined,
          emitidoEm: emitidoEm || undefined,
          validoAte: validoAte || undefined,
          observacoes: observacoes.trim() || undefined,
        }),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro')
    } finally { setSubmitting(false) }
  }

  return (
    <Drawer open={open} onClose={onClose} width={480}>
      <DrawerHeader title="Novo documento KYC" subtitle="Certidão, BI, procuração, etc." onClose={onClose} />
      <DrawerBody>
        {err && <div style={errBoxStyle}>{err}</div>}
        <form id="k-form" onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 12 }}>
          <Field label="Tipo *">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)} required>
              {KYC_TIPOS.map((t) => (<option key={t} value={t}>{t.replaceAll('_', ' ')}</option>))}
            </Select>
          </Field>
          <Field label="Número"><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Emitido em"><Input type="date" value={emitidoEm} onChange={(e) => setEmitidoEm(e.target.value)} /></Field>
            <Field label="Válido até"><Input type="date" value={validoAte} onChange={(e) => setValidoAte(e.target.value)} /></Field>
          </div>
          <Field label="Observações"><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="k-form" loading={submitting}>Criar</Button>
      </DrawerFooter>
    </Drawer>
  )
}

function MergeDrawer({ open, onClose, targetId, targetNome, onDone }: { open: boolean; onClose: () => void; targetId: string; targetNome: string; onDone: () => void }) {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [results, setResults] = useState<Array<{ id: string; nome: string; nif: string | null }>>([])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(search), 200); return () => clearTimeout(t) }, [search])

  useEffect(() => {
    if (!open || !session?.accessToken) return
    api<{ data: Array<{ id: string; nome: string; nif: string | null }> }>(
      `/entidades?limit=10${debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ''}`,
      { token: session.accessToken },
    )
      .then((r) => setResults((r.data ?? []).filter((e) => e.id !== targetId)))
      .catch(() => setResults([]))
  }, [open, debouncedQ, session?.accessToken, targetId])

  const submit = async () => {
    if (!session?.accessToken || !sourceId) return
    if (!confirm(`Confirmar fusão? "${results.find((r) => r.id === sourceId)?.nome}" será absorvida em "${targetNome}" e marcada como apagada.`)) return
    setSubmitting(true); setErr(null)
    try {
      await api(`/entidades/${targetId}/merge`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ sourceId }),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro a mesclar')
    } finally { setSubmitting(false) }
  }

  return (
    <Drawer open={open} onClose={onClose} width={520}>
      <DrawerHeader title="Mesclar entidades" subtitle={`Absorve outra entidade em "${targetNome}" (todas as partes e documentos passam para esta).`} onClose={onClose} />
      <DrawerBody>
        {err && <div style={errBoxStyle}>{err}</div>}
        <Input placeholder="Pesquisar entidade a absorver…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)', maxHeight: 320, overflow: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--k2-text-mute)' }}>Sem resultados.</div>
          ) : results.map((r) => (
            <label key={r.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--k2-border)', cursor: 'pointer', background: sourceId === r.id ? 'var(--k2-bg-hover)' : 'transparent' }}>
              <input type="radio" name="source" checked={sourceId === r.id} onChange={() => setSourceId(r.id)} />
              <div>
                <div style={{ fontSize: 13 }}>{r.nome}</div>
                {r.nif && <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>NIF {r.nif}</div>}
              </div>
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
          A entidade absorvida fica soft-deleted. Operação reversível pelo admin via restauro.
        </div>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} loading={submitting} disabled={!sourceId}>Mesclar</Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Helpers de layout ────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0, fontWeight: 500 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>{children}</div>
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--k2-text)', marginTop: 4 }}>{value ?? '—'}</div>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--k2-text-mute)', fontSize: 13, padding: 16, background: 'var(--k2-bg-elev)', border: '1px dashed var(--k2-border)', borderRadius: 'var(--k2-radius-sm)' }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
      {label}
      {children}
    </label>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderTop: '1px solid var(--k2-border)',
}

const trashBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--k2-border)',
  color: 'var(--k2-bad)',
  padding: '5px 8px',
  borderRadius: 'var(--k2-radius-sm)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
}

const errBoxStyle: React.CSSProperties = {
  background: 'var(--color-danger-bg)',
  color: 'var(--color-danger-text)',
  padding: '10px 14px',
  borderRadius: 'var(--k2-radius-sm)',
  fontSize: 13,
}
