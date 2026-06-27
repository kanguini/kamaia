'use client'

/**
 * Contract detail — Redesign "Command Center" (pós-auditoria UX).
 *
 * A v2 anterior era estruturalmente um clone do Contracko (5 tabs
 * icon-only, split-pane, blocos). Este redesign parte dos PONTOS
 * FRACOS dos CLM genéricos e inverte-os:
 *
 *   Contracko (reactivo)          →  Kamaia (proactivo)
 *   ─────────────────────────────────────────────────────────
 *   Metadata + chat para perguntar → "Precisa da tua atenção" no
 *                                     topo, resolvível in-line
 *   Compliance = 1 secção de 5     → Compliance = coluna vertebral,
 *                                     5 categorias angolanas sempre
 *                                     visíveis (o moat exposto)
 *   Contrato isolado               → Relação: "parceiro · N
 *                                     contratos · exposição total"
 *   Tab Eventos (só passado)       → Evolução passado→presente→futuro
 *   Tabs como navegação primária   → Tudo numa vista; tabs viram
 *                                     "Mais detalhes" colapsável
 *
 * Layout:
 *   Hero strip (estado, flags, próxima acção, [IA] [Editar])
 *   ┌─ PRECISA DA TUA ATENÇÃO (resolução in-line) ──────────┐
 *   ├──────────────────────────┬────────────────────────────┤
 *   │ Identificação            │  PDF preview (sticky)       │
 *   │ Compliance angolano (5)  │                             │
 *   │ Partes & relações        │                             │
 *   │ Detalhes do tipo         │                             │
 *   ├──────────────────────────┴────────────────────────────┤
 *   │ Evolução (timeline)                                    │
 *   ├────────────────────────────────────────────────────────┤
 *   │ ▸ Mais detalhes (Termos · Documentos · Conversa)       │
 *   └────────────────────────────────────────────────────────┘
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ChevronLeft,
  Sparkles,
  Edit2,
  MoreHorizontal,
  Scale,
  Paperclip,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { Badge } from '@/components/ui/badge'
import {
  ContratoEstado,
  contratoModo,
  contratoFlags,
  CONTRATO_FLAG_LABELS,
  userVisibleEstado,
  CONTRATO_ESTADO_VISIVEL_LABELS,
  type ContratoModo,
} from '@kamaia/shared-types'
import { estadoBadgeVariant } from '@/lib/clm-format'
import { useKamaiaAI, useKamaiaPageContext } from '@/components/kamaia-ai/kamaia-ai-provider'
import { PdfPreview } from '@/components/contratos/v2/pdf-preview'
import {
  ResumoIdentificacao,
  ResumoCustomFields,
} from '@/components/contratos/v2/resumo-blocks'
import { AtencaoBlock } from '@/components/contratos/v2/atencao-block'
import { ComplianceSpine } from '@/components/contratos/v2/compliance-spine'
import { RelacaoParceiro } from '@/components/contratos/v2/relacao-parceiro'
import { EvolucaoTimeline } from '@/components/contratos/v2/evolucao-timeline'
import type {
  ActoInput,
  DataChaveInput,
  ObrigacaoInput,
} from '@/components/contratos/v2/atencao-engine'
import { AssinarWizard } from '@/components/contratos/v2/assinar-wizard'
import { TermosDrawer } from '@/components/contratos/v2/termos-drawer'
import { EditorTab } from '@/components/contratos/editor-tab'
import { VersoesTab } from '@/components/contratos/versoes-tab'
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
  prazoRenovacaoMeses: number | null
  janelaDenunciaDias: number | null
  denunciaEm: string | null
  denunciaMotivo: string | null
  tipo: { id: string; nome: string } | null
  carteira: { id: string; nome: string } | null
  responsavel: { id: string; firstName: string; lastName: string } | null
}

interface ParteRef {
  id: string
  papel: string
  entidade: { id: string; nome: string }
}

// ─── Hook de sinais partilhados ──────────────────────────────────
// Fetch único dos sinais (actos, datas, obrigações, partes) que
// alimentam AtencaoBlock + ComplianceSpine + RelacaoParceiro. Evita
// 3 componentes a buscarem os mesmos endpoints.

function useContratoSinais(contratoId: string) {
  const { data: session } = useSession()
  const [actos, setActos] = useState<ActoInput[]>([])
  const [datas, setDatas] = useState<DataChaveInput[]>([])
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoInput[]>([])
  const [partes, setPartes] = useState<ParteRef[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!session?.accessToken) return
    const token = session.accessToken
    const [a, d, o, p] = await Promise.all([
      api<unknown>(`/compliance/contratos/${contratoId}/actos`, { token }).catch(() => []),
      api<unknown>(`/contratos/${contratoId}/datas-chave`, { token }).catch(() => []),
      api<unknown>(`/contratos/${contratoId}/obrigacoes`, { token }).catch(() => []),
      api<unknown>(`/contratos/${contratoId}/partes`, { token }).catch(() => []),
    ])
    setActos(unwrapList<ActoInput>(a))
    setDatas(unwrapList<DataChaveInput>(d))
    setObrigacoes(unwrapList<ObrigacaoInput>(o))
    setPartes(unwrapList<ParteRef>(p))
    setLoaded(true)
  }, [contratoId, session?.accessToken])

  useEffect(() => {
    let cancelled = false
    if (session?.accessToken) {
      void load().then(() => {
        if (cancelled) return
      })
    }
    return () => {
      cancelled = true
    }
  }, [load, session?.accessToken])

  return { actos, datas, obrigacoes, partes, loaded, reload: load }
}

// ─── Page ────────────────────────────────────────────────────────

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: contrato, loading, error, refetch } = useApi<Contrato>(
    `/contratos/${id}`,
  )
  const { setOpen: setAiOpen, send: aiSend } = useKamaiaAI()

  const modo: ContratoModo = contrato ? contratoModo(contrato.estado) : 'REPOSITORY'

  return contrato ? (
    <Inner
      contrato={contrato}
      modo={modo}
      onAiAnalysis={() => {
        setAiOpen(true)
        void aiSend(
          `Analisa o contrato ${contrato.numero ?? contrato.id} (${contrato.titulo}) e sumariza riscos, compliance pendente, e próximas acções.`,
        )
      }}
      onRefresh={() => void refetch()}
    />
  ) : (
    <DetailShell idForContext={id} loading={loading} error={error} />
  )
}

function DetailShell({
  idForContext,
  loading,
  error,
}: {
  idForContext: string
  loading: boolean
  error: string | null
}) {
  useKamaiaPageContext({ type: 'contratos.detail', contratoId: idForContext })
  if (error) return <div style={{ color: 'var(--k2-bad)' }}>{error}</div>
  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--k2-text-mute)', fontSize: 13 }}>
        {loading ? 'A carregar…' : 'Contrato não encontrado.'}
      </span>
    </div>
  )
}

function Inner({
  contrato,
  modo,
  onAiAnalysis,
  onRefresh,
}: {
  contrato: Contrato
  modo: ContratoModo
  onAiAnalysis: () => void
  onRefresh: () => void
}) {
  const [signWizardOpen, setSignWizardOpen] = useState(false)
  const [termosOpen, setTermosOpen] = useState(false)
  const [detalhesTab, setDetalhesTab] = useState<'termos' | 'documentos' | 'conversa' | null>(null)

  const sinais = useContratoSinais(contrato.id)

  useKamaiaPageContext({
    type: 'contratos.detail',
    contratoId: contrato.id,
    numeroInterno: contrato.numero ?? undefined,
  })

  const proximaAccao = proximaAccaoHint(contrato)
  const flags = contratoFlags(contrato.estado)
  const visivel = userVisibleEstado(contrato.estado)
  const readonly = modo === 'CLOSED'

  // Resolução de actos / vigência refresca contrato + sinais
  const onResolved = () => {
    onRefresh()
    void sinais.reload()
  }

  return (
    <div className="cd">
      {/* Hero */}
      <header className="cd-hero">
        <Link href="/contratos" className="cd-back">
          <ChevronLeft size={12} /> Contratos
        </Link>
        <div className="cd-hero-row">
          <div className="cd-hero-title">
            <h1 className="cd-h1">{contrato.titulo}</h1>
            <div className="cd-hero-meta">
              {contrato.numero && <span className="cd-numero">{contrato.numero}</span>}
              <span className="cd-dot">·</span>
              <Badge variant={estadoBadgeVariant(contrato.estado)}>
                {CONTRATO_ESTADO_VISIVEL_LABELS[visivel]}
              </Badge>
              {flags.map((f) => (
                <Badge key={f} variant="warning">
                  {CONTRATO_FLAG_LABELS[f]}
                </Badge>
              ))}
              {proximaAccao && (
                <>
                  <span className="cd-dot">·</span>
                  <span className={`cd-prox ${proximaAccao.urgent ? 'urgent' : ''}`}>
                    {proximaAccao.urgent && '⚠ '}
                    {proximaAccao.text}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="cd-hero-actions">
            <button type="button" className="cd-btn cd-btn-soft" onClick={onAiAnalysis}>
              <Sparkles size={13} /> Análise IA
            </button>
            {!readonly && (
              <button
                type="button"
                className="cd-btn cd-btn-primary"
                onClick={() => {
                  if (modo === 'SIGNATURE') setSignWizardOpen(true)
                  else if (modo === 'REPOSITORY') setTermosOpen(true)
                  else setDetalhesTab('termos')
                }}
              >
                <Edit2 size={12} />
                {modo === 'SIGNATURE' ? 'Enviar para assinar' : modo === 'DRAFTING' ? 'Editor' : 'Editar'}
              </button>
            )}
            <button type="button" className="cd-btn cd-btn-soft cd-btn-icon" aria-label="Mais acções">
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Precisa da tua atenção — lidera a página */}
      {sinais.loaded && (
        <AtencaoBlock
          contratoId={contrato.id}
          contrato={{
            estado: contrato.estado,
            dataTermo: contrato.dataTermo,
            renovacaoAutomatica: contrato.renovacaoAutomatica,
            prazoRenovacaoMeses: contrato.prazoRenovacaoMeses,
            janelaDenunciaDias: contrato.janelaDenunciaDias,
            denunciaEm: contrato.denunciaEm,
          }}
          actos={sinais.actos}
          datas={sinais.datas}
          obrigacoes={sinais.obrigacoes}
          onResolved={onResolved}
        />
      )}

      {/* Split: dados + PDF */}
      <div className="cd-split">
        <div className="cd-col">
          <ResumoIdentificacao contrato={contrato} />
          <ComplianceSpine actos={sinais.actos} />
          <RelacaoParceiro contratoId={contrato.id} partes={sinais.partes} />
          <ResumoCustomFields contratoId={contrato.id} />
        </div>
        <aside className="cd-pdf">
          <PdfPreview contratoId={contrato.id} />
        </aside>
      </div>

      {/* Evolução temporal */}
      <EvolucaoTimeline contratoId={contrato.id} />

      {/* Mais detalhes — secundário, colapsável */}
      <div className="cd-mais">
        <div className="cd-mais-tabs">
          {(['termos', 'documentos', 'conversa'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`cd-mais-tab ${detalhesTab === t ? 'active' : ''}`}
              onClick={() => setDetalhesTab(detalhesTab === t ? null : t)}
            >
              {t === 'termos' && <Scale size={13} />}
              {t === 'documentos' && <Paperclip size={13} />}
              {t === 'conversa' && <MessageSquare size={13} />}
              <span>
                {t === 'termos' ? 'Termos & cláusulas' : t === 'documentos' ? 'Documentos & versões' : 'Conversa & histórico'}
              </span>
              <ChevronDown size={12} className={`cd-mais-chev ${detalhesTab === t ? 'open' : ''}`} />
            </button>
          ))}
        </div>
        {detalhesTab === 'termos' && (
          <div className="cd-mais-body">
            <EditorTab contratoId={contrato.id} />
          </div>
        )}
        {detalhesTab === 'documentos' && (
          <div className="cd-mais-body">
            <VersoesTab contratoId={contrato.id} />
            <DocumentosTab contratoId={contrato.id} />
          </div>
        )}
        {detalhesTab === 'conversa' && (
          <div className="cd-mais-body">
            <div className="cd-placeholder">
              Comentários por cláusula + timeline detalhada em consolidação.
            </div>
          </div>
        )}
      </div>

      <AssinarWizard
        open={signWizardOpen}
        onClose={() => setSignWizardOpen(false)}
        contratoId={contrato.id}
      />
      <TermosDrawer
        open={termosOpen}
        onClose={() => setTermosOpen(false)}
        contratoId={contrato.id}
        initial={{
          dataTermo: contrato.dataTermo,
          renovacaoAutomatica: contrato.renovacaoAutomatica,
          prazoRenovacaoMeses: contrato.prazoRenovacaoMeses,
          janelaDenunciaDias: contrato.janelaDenunciaDias,
        }}
        onSaved={onResolved}
      />

      <style jsx>{`
        .cd {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cd-hero {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cd-back {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--k2-text-mute);
          font-size: 11px;
          text-decoration: none;
          align-self: flex-start;
        }
        .cd-back:hover { color: var(--k2-text-dim); }
        .cd-hero-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .cd-h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--k2-text);
        }
        .cd-hero-meta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          font-size: 12px;
          color: var(--k2-text-mute);
          font-variant-numeric: tabular-nums;
          flex-wrap: wrap;
        }
        .cd-numero { color: var(--k2-text-dim); }
        .cd-dot { color: var(--k2-text-mute); opacity: 0.6; }
        .cd-prox { color: var(--k2-text-dim); }
        .cd-prox.urgent { color: var(--k2-warn); font-weight: 500; }
        .cd-hero-actions { display: inline-flex; gap: 6px; flex-shrink: 0; }
        .cd-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: var(--k2-radius-sm);
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 120ms ease, border-color 120ms ease;
          border: 1px solid var(--k2-border);
        }
        .cd-btn-soft { background: var(--k2-bg-elev); color: var(--k2-text-dim); }
        .cd-btn-soft:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
        .cd-btn-primary {
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border-color: var(--k2-accent);
        }
        .cd-btn-primary:hover { opacity: 0.9; }
        .cd-btn-icon { padding: 6px; }

        .cd-split {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
        }
        @media (max-width: 1100px) {
          .cd-split { grid-template-columns: 1fr; }
        }
        .cd-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }
        .cd-pdf {
          position: sticky;
          top: 16px;
          align-self: flex-start;
          height: calc(100vh - 180px);
          min-height: 560px;
        }
        @media (max-width: 1100px) {
          .cd-pdf { position: static; height: auto; min-height: 480px; }
        }

        .cd-mais {
          border-top: 1px solid var(--k2-border);
          padding-top: 12px;
        }
        .cd-mais-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .cd-mais-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text-dim);
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
        }
        .cd-mais-tab:hover { background: var(--k2-bg-hover); color: var(--k2-text); }
        .cd-mais-tab.active { color: var(--k2-text); border-color: var(--k2-border-strong); }
        .cd-mais-chev { transition: transform 160ms ease; }
        .cd-mais-chev.open { transform: rotate(180deg); }
        .cd-mais-body {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cd-placeholder {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: var(--k2-text-mute);
        }
      `}</style>
    </div>
  )
}

function proximaAccaoHint(c: Contrato): { text: string; urgent: boolean } | null {
  const now = new Date()
  if (c.dataTermo) {
    const termo = new Date(c.dataTermo)
    const ms = termo.getTime()
    // Guard: data inválida não pode produzir "em NaN dias".
    if (Number.isFinite(ms)) {
      const dias = Math.ceil((ms - now.getTime()) / (1000 * 60 * 60 * 24))
      if (dias < 0) return { text: `Termo expirou há ${Math.abs(dias)} dias`, urgent: true }
      if (dias === 0) return { text: `Termo hoje`, urgent: true }
      if (dias <= 30) {
        const tipoTermo = c.renovacaoAutomatica ? 'Renova' : 'Termina'
        return { text: `${tipoTermo} em ${dias} dias`, urgent: dias <= 7 }
      }
    }
  }
  if (c.estado === ContratoEstado.PRONTO_ASSINATURA) {
    return { text: 'Pronto para assinatura', urgent: true }
  }
  if (c.estado === ContratoEstado.DRAFTING || c.estado === ContratoEstado.REV_INTERNA) {
    return { text: 'Em redacção', urgent: false }
  }
  return null
}
