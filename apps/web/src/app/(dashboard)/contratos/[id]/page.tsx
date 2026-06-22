'use client'

/**
 * Kamaia CLM — Contrato detail with tabs.
 *
 * Tabs: Resumo, Versões, Partes, Datas-chave, Negociação, Compliance, Timeline, Terminação.
 * Each tab fetches its own endpoint when activated.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import {
  ContratoEstado,
  PartePapel,
  DataChaveTipo,
  DATA_CHAVE_TIPO_LABELS,
  ContratoEventoTipo,
  NegociacaoPontoEstado,
  NegociacaoPontoCriticidade,
  TerminacaoTipo,
} from '@kamaia/shared-types'
import { estadoBadgeVariant, estadoLabel, fmtDate, fmtDateTime, fmtMoney } from '@/lib/clm-format'
import { ChevronLeft } from 'lucide-react'
import { EditorTab } from '@/components/contratos/editor-tab'
import { PartilhaTab } from '@/components/contratos/partilha-tab'
import { AssinaturasTab } from '@/components/contratos/assinaturas-tab'
import { ComplianceTab as ComplianceTabNew } from '@/components/contratos/compliance-tab'
import { VersoesTab as VersoesTabNew } from '@/components/contratos/versoes-tab'
import { DocumentosTab } from '@/components/contratos/documentos-tab'

interface Contrato {
  id: string
  numero: string | null
  titulo: string
  descricao: string | null
  estado: ContratoEstado
  valor: string | null
  moeda: string | null
  leiAplicavel: string | null
  foro: string | null
  dataAssinatura: string | null
  dataInicioVigencia: string | null
  dataTermo: string | null
  renovacaoAutomatica: boolean
  janelaDenunciaDias: number | null
  tipo: { id: string; nome: string } | null
  carteira: { id: string; nome: string } | null
  responsavel: { id: string; firstName: string; lastName: string } | null
}

type TabKey = 'resumo' | 'editor' | 'partilha' | 'assinaturas' | 'versoes' | 'documentos' | 'partes' | 'datas-chave' | 'negociacao' | 'compliance' | 'timeline' | 'terminacao'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'editor', label: 'Editor' },
  { key: 'partilha', label: 'Partilha' },
  { key: 'assinaturas', label: 'Assinaturas' },
  { key: 'versoes', label: 'Versões' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'partes', label: 'Partes' },
  { key: 'datas-chave', label: 'Datas-chave' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'terminacao', label: 'Terminação' },
]

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabKey>('resumo')
  const { data: contrato, loading, error } = useApi<Contrato>(`/contratos/${id}`)

  if (error) {
    return <div style={{ color: 'var(--k2-bad)' }}>{error}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/contratos" style={{ color: 'var(--k2-text-dim)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={12} /> Contratos
      </Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--k2-text-mute)', fontVariantNumeric: 'tabular-nums' }}>
            {contrato?.numero ?? '—'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 0' }}>
            {loading ? '…' : contrato?.titulo}
          </h1>
        </div>
        {contrato && (
          <Badge variant={estadoBadgeVariant(contrato.estado)}>{estadoLabel(contrato.estado)}</Badge>
        )}
      </header>

      <nav
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--k2-border)',
          overflowX: 'auto',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--k2-accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--k2-text)' : 'var(--k2-text-dim)',
              fontSize: 13,
              fontWeight: tab === t.key ? 500 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div>
        {tab === 'resumo' && contrato && <ResumoTab contrato={contrato} />}
        {tab === 'editor' && <EditorTab contratoId={String(id)} />}
        {tab === 'partilha' && <PartilhaTab contratoId={String(id)} />}
        {tab === 'assinaturas' && <AssinaturasTab contratoId={String(id)} />}
        {tab === 'versoes' && <VersoesTabNew contratoId={String(id)} />}
        {tab === 'documentos' && <DocumentosTab contratoId={String(id)} />}
        {tab === 'partes' && <PartesTab contratoId={String(id)} />}
        {tab === 'datas-chave' && <DatasChaveTab contratoId={String(id)} />}
        {tab === 'negociacao' && <NegociacaoTab contratoId={String(id)} />}
        {tab === 'compliance' && <ComplianceTabNew contratoId={String(id)} />}
        {tab === 'timeline' && <TimelineTab contratoId={String(id)} />}
        {tab === 'terminacao' && <TerminacaoTab contratoId={String(id)} />}
      </div>
    </div>
  )
}

function ResumoTab({ contrato }: { contrato: Contrato }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      <Info label="Tipo" value={contrato.tipo?.nome} />
      <Info label="Carteira" value={contrato.carteira?.nome} />
      <Info label="Responsável" value={contrato.responsavel ? `${contrato.responsavel.firstName} ${contrato.responsavel.lastName}` : null} />
      <Info label="Valor" value={fmtMoney(contrato.valor, contrato.moeda)} />
      <Info label="Lei aplicável" value={contrato.leiAplicavel} />
      <Info label="Foro" value={contrato.foro} />
      <Info label="Data assinatura" value={fmtDate(contrato.dataAssinatura)} />
      <Info label="Início vigência" value={fmtDate(contrato.dataInicioVigencia)} />
      <Info label="Data termo" value={fmtDate(contrato.dataTermo)} />
      <Info label="Renovação automática" value={contrato.renovacaoAutomatica ? 'Sim' : 'Não'} />
      <Info label="Janela de denúncia" value={contrato.janelaDenunciaDias ? `${contrato.janelaDenunciaDias} dias` : null} />
      {contrato.descricao && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Info label="Descrição" value={contrato.descricao} multiline />
        </div>
      )}
    </div>
  )
}

function Info({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  return (
    <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--k2-text)', marginTop: 4, whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
        {value ?? '—'}
      </div>
    </div>
  )
}

// ─── Versões ─────────────────────────────────────────────
// VersoesTab agora vive em components/contratos/versoes-tab.tsx
// (lista + drawer de importar minuta com DocumentDropzone).

// ─── Partes ─────────────────────────────────────────────
interface Parte {
  id: string
  papel: PartePapel
  ordem: number
  entidade: { id: string; nome: string }
}

function PartesTab({ contratoId }: { contratoId: string }) {
  const { data, loading } = useApi<Parte[]>(`/contratos/${contratoId}/partes`)
  if (loading) return <Loading />
  if (!data || data.length === 0) return <EmptyMsg text="Sem partes registadas." />
  return (
    <List>
      {data.map((p) => (
        <ListRow key={p.id}>
          <Link href={`/entidades/${p.entidade.id}`} style={{ color: 'var(--k2-text)', textDecoration: 'none', fontWeight: 500 }}>
            {p.entidade.nome}
          </Link>
          <Badge variant="info">{p.papel.replaceAll('_', ' ')}</Badge>
        </ListRow>
      ))}
    </List>
  )
}

// ─── Datas-chave ─────────────────────────────────────────
interface DataChave {
  id: string
  tipo: DataChaveTipo
  data: string
  descricao: string | null
  cumprido: boolean
}

function DatasChaveTab({ contratoId }: { contratoId: string }) {
  const { data, loading } = useApi<DataChave[]>(`/contratos/${contratoId}/datas-chave`)
  if (loading) return <Loading />
  if (!data || data.length === 0) return <EmptyMsg text="Sem datas-chave registadas." />
  return (
    <List>
      {data.map((d) => (
        <ListRow key={d.id}>
          <div style={{ fontWeight: 500 }}>{DATA_CHAVE_TIPO_LABELS[d.tipo]}</div>
          <div style={{ color: 'var(--k2-text-dim)', fontSize: 12 }}>{fmtDate(d.data)}</div>
          {d.descricao && <div style={{ color: 'var(--k2-text-dim)', fontSize: 12, gridColumn: '1 / -1' }}>{d.descricao}</div>}
          <Badge variant={d.cumprido ? 'success' : 'pendente'}>{d.cumprido ? 'Cumprido' : 'Pendente'}</Badge>
        </ListRow>
      ))}
    </List>
  )
}

// ─── Negociação ─────────────────────────────────────────
interface NegociacaoPonto {
  id: string
  titulo: string
  descricao: string | null
  estado: NegociacaoPontoEstado
  criticidade: NegociacaoPontoCriticidade
}

function NegociacaoTab({ contratoId }: { contratoId: string }) {
  const { data, loading } = useApi<NegociacaoPonto[]>(`/contratos/${contratoId}/negociacao`)
  if (loading) return <Loading />
  if (!data || data.length === 0) return <EmptyMsg text="Sem pontos de negociação." />
  return (
    <List>
      {data.map((p) => (
        <ListRow key={p.id}>
          <div style={{ fontWeight: 500 }}>{p.titulo}</div>
          <Badge variant={p.criticidade === 'CRITICA' || p.criticidade === 'ALTA' ? 'danger' : 'info'}>{p.criticidade}</Badge>
          <Badge variant={p.estado === 'ACEITE' ? 'success' : p.estado === 'REJEITADO' ? 'danger' : 'pendente'}>
            {p.estado.replaceAll('_', ' ')}
          </Badge>
          {p.descricao && <div style={{ color: 'var(--k2-text-dim)', fontSize: 12, gridColumn: '1 / -1' }}>{p.descricao}</div>}
        </ListRow>
      ))}
    </List>
  )
}

// ─── Compliance ─────────────────────────────────────────
// Compliance tab agora vive em components/contratos/compliance-tab.tsx
// (versão accionável: re-avaliar + acções por acto). Tipos e UI
// vivem todos nesse ficheiro.

// ─── Timeline ─────────────────────────────────────────
interface Evento {
  id: string
  tipo: ContratoEventoTipo
  descricao: string
  criadoEm: string
  actor: { firstName: string; lastName: string } | null
}

function TimelineTab({ contratoId }: { contratoId: string }) {
  const { data, loading } = useApi<Evento[]>(`/contratos/${contratoId}/eventos`)
  if (loading) return <Loading />
  if (!data || data.length === 0) return <EmptyMsg text="Sem eventos." />
  return (
    <div style={{ position: 'relative', paddingLeft: 16, borderLeft: '1px solid var(--k2-border)' }}>
      {data.map((e) => (
        <div key={e.id} style={{ position: 'relative', paddingBottom: 16 }}>
          <span style={{ position: 'absolute', left: -22, top: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--k2-accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{e.tipo.replaceAll('_', ' ')}</div>
          <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>{e.descricao}</div>
          <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 2 }}>
            {fmtDateTime(e.criadoEm)} {e.actor && `· ${e.actor.firstName} ${e.actor.lastName}`}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Terminação ─────────────────────────────────────────
interface Terminacao {
  id: string
  tipo: TerminacaoTipo
  motivo: string | null
  dataEfectiva: string
  criadoEm: string
}

function TerminacaoTab({ contratoId }: { contratoId: string }) {
  const { data, loading } = useApi<Terminacao | null>(`/contratos/${contratoId}/terminacao`)
  if (loading) return <Loading />
  if (!data) return <EmptyMsg text="Contrato não terminado." />
  return (
    <List>
      <ListRow>
        <div style={{ fontWeight: 500 }}>{data.tipo.replaceAll('_', ' ')}</div>
        <div style={{ color: 'var(--k2-text-dim)', fontSize: 12 }}>Data efectiva: {fmtDate(data.dataEfectiva)}</div>
        {data.motivo && <div style={{ color: 'var(--k2-text-dim)', fontSize: 12, gridColumn: '1 / -1' }}>{data.motivo}</div>}
      </ListRow>
    </List>
  )
}

// ─── Shared bits ─────────────────────────────────────────
function Loading() {
  return <div style={{ color: 'var(--k2-text-mute)', fontSize: 13, padding: 16 }}>A carregar…</div>
}
function EmptyMsg({ text }: { text: string }) {
  return <div style={{ color: 'var(--k2-text-mute)', fontSize: 13, padding: 16 }}>{text}</div>
}
function List({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
function ListRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '12px 16px', borderTop: '1px solid var(--k2-border)' }}>
      {children}
    </div>
  )
}
