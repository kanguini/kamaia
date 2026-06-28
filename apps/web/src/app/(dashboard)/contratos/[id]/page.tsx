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
  FilePlus,
  FilePlus2,
  GitCompare,
  Check,
  CheckCircle2,
  Send,
  PenLine,
  Link2,
  CalendarClock,
  ListChecks,
  RefreshCw,
  Ban,
  Archive,
  Download,
  PlayCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { Badge } from '@/components/ui/badge'
import {
  ContratoEstado,
  ContratoOrigem,
  contratoCapacidades,
  contratoFlags,
  CONTRATO_FLAG_LABELS,
  ACCAO_LABELS,
  userVisibleEstado,
  CONTRATO_ESTADO_VISIVEL_LABELS,
  type AccaoContrato,
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
import { AdendaDrawer } from '@/components/contratos/v2/adenda-drawer'
import { TerminarDrawer } from '@/components/contratos/v2/terminar-drawer'
import { NegociacaoDrawer } from '@/components/contratos/v2/negociacao-drawer'
import { ComentariosPanel } from '@/components/contratos/comentarios-panel'
import { LifecycleRail } from '@/components/contratos/v2/lifecycle-rail'
import { ContratoTarefas } from '@/components/contratos/v2/contrato-tarefas'
import { EditorTab } from '@/components/contratos/editor-tab'
import { VersoesTab } from '@/components/contratos/versoes-tab'
import { DocumentosTab } from '@/components/contratos/documentos-tab'
import { ObrigacoesTab } from '@/components/contratos/obrigacoes-tab'
import { AssinaturasTab } from '@/components/contratos/assinaturas-tab'

type DetalheTab = 'termos' | 'documentos' | 'obrigacoes' | 'assinaturas' | 'conversa'

interface Contrato {
  id: string
  numero: string | null
  titulo: string
  descricao: string | null
  estado: ContratoEstado
  origem: ContratoOrigem
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

  const askAI = useCallback(
    (prompt: string) => {
      setAiOpen(true)
      void aiSend(prompt)
    },
    [setAiOpen, aiSend],
  )

  return contrato ? (
    <Inner
      contrato={contrato}
      onAiAnalysis={() =>
        askAI(
          `Analisa o contrato ${contrato.numero ?? contrato.id} (${contrato.titulo}) e sumariza riscos, compliance pendente, e próximas acções.`,
        )
      }
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
  onAiAnalysis,
  onRefresh,
}: {
  contrato: Contrato
  onAiAnalysis: () => void
  onRefresh: () => void
}) {
  const { data: session } = useSession()
  const [signWizardOpen, setSignWizardOpen] = useState(false)
  const [termosOpen, setTermosOpen] = useState(false)
  const [adendaOpen, setAdendaOpen] = useState(false)
  const [terminarOpen, setTerminarOpen] = useState(false)
  const [negociacaoOpen, setNegociacaoOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [detalhesTab, setDetalhesTab] = useState<DetalheTab | null>(null)

  const sinais = useContratoSinais(contrato.id)

  useKamaiaPageContext({
    type: 'contratos.detail',
    contratoId: contrato.id,
    numeroInterno: contrato.numero ?? undefined,
  })

  const proximaAccao = proximaAccaoHint(contrato)
  const flags = contratoFlags(contrato.estado)
  const visivel = userVisibleEstado(contrato.estado)
  // Fonte de verdade da visualização por fase: que acções e tabs mostrar.
  const caps = contratoCapacidades(contrato.estado, contrato.origem)

  // Resolução de actos / vigência refresca contrato + sinais
  const onResolved = () => {
    onRefresh()
    void sinais.reload()
  }

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const openTab = (t: DetalheTab) => {
    setDetalhesTab(t)
    setTimeout(() => scrollTo('cd-mais'), 60)
  }

  // Tabs do "Mais detalhes" dirigidas pela fase: o Editor só aparece
  // quando o corpo é editável; Obrigações/Assinaturas conforme a fase.
  const maisTabs: { key: DetalheTab; label: string; icon: ReactNode }[] = [
    ...(caps.pode('EDITAR_CORPO')
      ? [{ key: 'termos' as const, label: 'Termos & cláusulas', icon: <Scale size={13} /> }]
      : []),
    { key: 'documentos', label: 'Documentos & versões', icon: <Paperclip size={13} /> },
    ...(caps.tabs.includes('OBRIGACOES')
      ? [{ key: 'obrigacoes' as const, label: 'Obrigações', icon: <ListChecks size={13} /> }]
      : []),
    ...(caps.tabs.includes('ASSINATURAS')
      ? [{ key: 'assinaturas' as const, label: 'Assinaturas', icon: <PenLine size={13} /> }]
      : []),
    { key: 'conversa', label: 'Conversa & histórico', icon: <MessageSquare size={13} /> },
  ]

  const transitar = async (para: ContratoEstado, motivo?: string) => {
    if (!session?.accessToken) return
    try {
      await api(`/contratos/${contrato.id}/transicao`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ para, motivo }),
      })
      onResolved()
    } catch {
      // Estado real reflecte-se no refetch; transição inválida é barrada no backend.
    }
  }

  // Conclui o sub-ciclo conforme o estado: adenda/disputa voltam a
  // ACTIVO; terminação avança para TERMINADO.
  const concluirSubciclo = () => {
    if (contrato.estado === ContratoEstado.EM_TERMINACAO) {
      if (window.confirm('Concluir a terminação? O contrato passa a terminado.'))
        void transitar(ContratoEstado.TERMINADO)
    } else {
      // EM_ADENDA ou EM_DISPUTA → regressa a ACTIVO
      if (window.confirm('Concluir e voltar a pôr o contrato activo?'))
        void transitar(ContratoEstado.ACTIVO)
    }
  }

  // Registry: cada acção do resolver → ícone + destino. Total sobre
  // AccaoContrato, por isso qualquer acção que o resolver permita tem
  // sempre um handler. Acções sem ecrã dedicado encaminham para a IA
  // (que serve a gestão) — interino e honesto.
  const actionDefs: Record<AccaoContrato, { icon: ReactNode; run: () => void }> = {
    EDITAR_CORPO: { icon: <Edit2 size={13} />, run: () => openTab('termos') },
    NOVA_VERSAO: { icon: <FilePlus size={13} />, run: () => openTab('documentos') },
    ENVIAR_NEGOCIACAO: {
      icon: <Send size={13} />,
      run: () => void transitar(ContratoEstado.EM_NEGOCIACAO),
    },
    NOVO_PONTO: { icon: <MessageSquare size={13} />, run: () => setNegociacaoOpen(true) },
    COMPARAR: { icon: <GitCompare size={13} />, run: () => openTab('documentos') },
    COMENTAR: { icon: <MessageSquare size={13} />, run: () => openTab('conversa') },
    APROVAR: {
      icon: <Check size={13} />,
      run: () =>
        void transitar(
          contrato.estado === ContratoEstado.EM_NEGOCIACAO
            ? ContratoEstado.APROVACAO
            : ContratoEstado.PRONTO_ASSINATURA,
        ),
    },
    PEDIR_ASSINATURA: { icon: <PenLine size={13} />, run: () => setSignWizardOpen(true) },
    PARTILHAR_LINK: { icon: <Link2 size={13} />, run: () => setSignWizardOpen(true) },
    REGISTAR_ASSINATURA: { icon: <PenLine size={13} />, run: () => setSignWizardOpen(true) },
    ADICIONAR_ADENDA: { icon: <FilePlus2 size={13} />, run: () => setAdendaOpen(true) },
    ACTIVAR: {
      icon: <PlayCircle size={13} />,
      run: () => void transitar(ContratoEstado.ACTIVO),
    },
    CONCLUIR_SUBCICLO: { icon: <CheckCircle2 size={13} />, run: concluirSubciclo },
    GERIR_DATAS: { icon: <CalendarClock size={13} />, run: () => setTermosOpen(true) },
    GERIR_OBRIGACOES: { icon: <ListChecks size={13} />, run: () => openTab('obrigacoes') },
    RENOVAR: { icon: <RefreshCw size={13} />, run: () => setTermosOpen(true) },
    TERMINAR: { icon: <Ban size={13} />, run: () => setTerminarOpen(true) },
    REVER_COMPLIANCE: { icon: <Scale size={13} />, run: () => scrollTo('cd-compliance') },
    ARQUIVAR: {
      icon: <Archive size={13} />,
      run: () => {
        if (window.confirm('Arquivar este contrato? Fica em modo de leitura.'))
          void transitar(ContratoEstado.ARQUIVADO)
      },
    },
    DESCARREGAR: { icon: <Download size={13} />, run: () => openTab('documentos') },
  }

  const runAccao = (a: AccaoContrato) => {
    setMenuOpen(false)
    actionDefs[a].run()
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
            {caps.accaoPrimaria && (
              <button
                type="button"
                className="cd-btn cd-btn-primary"
                onClick={() => runAccao(caps.accaoPrimaria!)}
              >
                {actionDefs[caps.accaoPrimaria].icon}
                {ACCAO_LABELS[caps.accaoPrimaria]}
              </button>
            )}
            {caps.accoes.length > 0 && (
              <div className="cd-menu-wrap">
                <button
                  type="button"
                  className="cd-btn cd-btn-soft cd-btn-icon"
                  aria-label="Mais acções"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <>
                    <div className="cd-menu-backdrop" onClick={() => setMenuOpen(false)} />
                    <div className="cd-menu" role="menu">
                      {caps.accoes.map((a) => (
                        <button
                          key={a}
                          type="button"
                          role="menuitem"
                          className="cd-menu-item"
                          onClick={() => runAccao(a)}
                        >
                          {actionDefs[a].icon}
                          <span>{ACCAO_LABELS[a]}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Rail do ciclo de vida — adapta-se a criado vs herdado */}
      <LifecycleRail estado={contrato.estado} origem={contrato.origem} />

      {/* Aviso de sub-ciclo (adenda / disputa / terminação em curso) */}
      {caps.aviso && (
        <div className="cd-aviso" role="status">
          {caps.aviso}
        </div>
      )}

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
          <div id="cd-compliance">
            <ComplianceSpine actos={sinais.actos} />
          </div>
          <RelacaoParceiro contratoId={contrato.id} partes={sinais.partes} />
          <ContratoTarefas contratoId={contrato.id} />
          <ResumoCustomFields contratoId={contrato.id} />
        </div>
        <aside className="cd-pdf">
          <PdfPreview contratoId={contrato.id} />
        </aside>
      </div>

      {/* Evolução temporal */}
      <EvolucaoTimeline contratoId={contrato.id} />

      {/* Mais detalhes — secundário, colapsável, dirigido pela fase */}
      <div className="cd-mais" id="cd-mais">
        <div className="cd-mais-tabs">
          {maisTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`cd-mais-tab ${detalhesTab === t.key ? 'active' : ''}`}
              onClick={() => setDetalhesTab(detalhesTab === t.key ? null : t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
              <ChevronDown size={12} className={`cd-mais-chev ${detalhesTab === t.key ? 'open' : ''}`} />
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
        {detalhesTab === 'obrigacoes' && (
          <div className="cd-mais-body">
            <ObrigacoesTab contratoId={contrato.id} />
          </div>
        )}
        {detalhesTab === 'assinaturas' && (
          <div className="cd-mais-body">
            <AssinaturasTab contratoId={contrato.id} />
          </div>
        )}
        {detalhesTab === 'conversa' && (
          <div className="cd-mais-body">
            <ComentariosPanel contratoId={contrato.id} versaoId={null} />
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
      <AdendaDrawer
        open={adendaOpen}
        onClose={() => setAdendaOpen(false)}
        contratoId={contrato.id}
        contratoTitulo={contrato.titulo}
        onSaved={onResolved}
      />
      <TerminarDrawer
        open={terminarOpen}
        onClose={() => setTerminarOpen(false)}
        contratoId={contrato.id}
        onSaved={onResolved}
      />
      <NegociacaoDrawer
        open={negociacaoOpen}
        onClose={() => setNegociacaoOpen(false)}
        contratoId={contrato.id}
        onChanged={onResolved}
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

        .cd-menu-wrap { position: relative; }
        .cd-menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }
        .cd-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 41;
          min-width: 220px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          box-shadow: 0 8px 28px -12px rgba(0, 0, 0, 0.5);
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .cd-menu-item {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 8px 10px;
          border: 0;
          background: none;
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text-dim);
          font-size: 12.5px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
        }
        .cd-menu-item:hover { background: var(--k2-bg-hover); color: var(--k2-text); }

        .cd-aviso {
          background: var(--k2-warn-bg, rgba(180, 130, 20, 0.1));
          border: 1px solid var(--k2-warn-border, rgba(180, 130, 20, 0.3));
          color: var(--k2-warn);
          padding: 9px 14px;
          border-radius: var(--k2-radius-sm);
          font-size: 12.5px;
          font-weight: 500;
        }

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
