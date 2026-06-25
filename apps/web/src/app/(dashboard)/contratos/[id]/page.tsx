'use client'

/**
 * Contract detail v2 — redesign Sprint 2.2.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │ Hero strip (breadcrumb + título + estado + ⚡)  │
 *   ├──────────────────┬──────────────────────────────┤
 *   │ Tab Resumo       │ PDF preview live             │
 *   │ ▸ Identificação  │ (sempre visível)             │
 *   │ ▸ Partes         │                              │
 *   │ ▸ Compliance     │                              │
 *   │ ▸ Próximos       │                              │
 *   │ ▸ Custom fields  │                              │
 *   └──────────────────┴──────────────────────────────┘
 *
 * Mudanças face à legacy:
 *  - 5 tabs icon-only (sem texto, ícones com tooltip)
 *  - Split-pane: dados esquerda + PDF direita
 *  - Resumo é uma stack de blocos accionáveis, não uma grelha de
 *    cartões "—"
 *  - Inline natural language: "renova em 8 dias", "em atraso"
 *  - Bloco Compliance angolano visível por defeito (moat exposto)
 *  - Custom fields renderizam dinamicamente conforme o tipo
 *
 * Sprint 2.3 introduzirá modos derivados do estado (Drafting,
 * Signature, Repository). Sprint 2.4 adiciona edição inline + acções
 * do Kamaia AI no header.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft,
  FileText,
  Scale,
  Bell,
  Paperclip,
  MessageSquare,
  Sparkles,
  Edit2,
  MoreHorizontal,
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { ContratoEstado } from '@kamaia/shared-types'
import { estadoBadgeVariant, estadoLabel } from '@/lib/clm-format'
import { useKamaiaAI, useKamaiaPageContext } from '@/components/kamaia-ai/kamaia-ai-provider'
import { PdfPreview } from '@/components/contratos/v2/pdf-preview'
import {
  ResumoIdentificacao,
  ResumoPartes,
  ResumoCompliance,
  ResumoProximosEventos,
  ResumoCustomFields,
} from '@/components/contratos/v2/resumo-blocks'
import {
  EditorTab,
} from '@/components/contratos/editor-tab'
import { ObrigacoesTab } from '@/components/contratos/obrigacoes-tab'
import { VersoesTab } from '@/components/contratos/versoes-tab'
import { DocumentosTab } from '@/components/contratos/documentos-tab'
import { ComplianceTab } from '@/components/contratos/compliance-tab'

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

type TabKey = 'resumo' | 'termos' | 'eventos' | 'documentos' | 'conversa'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ElementType
}

const TABS: TabDef[] = [
  { key: 'resumo', label: 'Resumo', icon: FileText },
  { key: 'termos', label: 'Termos & cláusulas', icon: Scale },
  { key: 'eventos', label: 'Eventos & notificações', icon: Bell },
  { key: 'documentos', label: 'Documentos & versões', icon: Paperclip },
  { key: 'conversa', label: 'Conversa & histórico', icon: MessageSquare },
]

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabKey>('resumo')
  const { data: contrato, loading, error } = useApi<Contrato>(`/contratos/${id}`)
  const { setOpen: setAiOpen, send: aiSend } = useKamaiaAI()

  // Declara o pageContext para o agente saber em que contrato estamos
  useKamaiaPageContext({
    type: 'contratos.detail',
    contratoId: id,
    numeroInterno: contrato?.numero ?? undefined,
  })

  if (error) {
    return <div style={{ color: 'var(--k2-bad)' }}>{error}</div>
  }

  const proximaAccao = contrato ? proximaAccaoHint(contrato) : null

  return (
    <div className="cd-page">
      {/* Hero */}
      <header className="cd-hero">
        <Link href="/contratos" className="cd-back">
          <ChevronLeft size={12} /> Contratos
        </Link>
        <div className="cd-hero-row">
          <div className="cd-hero-title">
            <h1 className="cd-h1">
              {loading ? '…' : contrato?.titulo ?? 'Contrato'}
            </h1>
            <div className="cd-hero-meta">
              {contrato?.numero && <span className="cd-numero">{contrato.numero}</span>}
              {contrato && (
                <>
                  <span className="cd-dot">·</span>
                  <Badge variant={estadoBadgeVariant(contrato.estado)}>
                    {estadoLabel(contrato.estado)}
                  </Badge>
                </>
              )}
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
          {contrato && (
            <div className="cd-hero-actions">
              <button
                type="button"
                className="cd-btn cd-btn-soft"
                onClick={() => {
                  setAiOpen(true)
                  void aiSend(
                    `Analisa o contrato ${contrato.numero ?? contrato.id} (${contrato.titulo}) e sumariza riscos, compliance pendente, e próximas acções.`,
                  )
                }}
              >
                <Sparkles size={13} /> Análise IA
              </button>
              <button type="button" className="cd-btn cd-btn-primary">
                <Edit2 size={12} /> Editar
              </button>
              <button
                type="button"
                className="cd-btn cd-btn-soft cd-btn-icon"
                aria-label="Mais acções"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs icon-only */}
      <nav className="cd-tabs" role="tablist">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={t.label}
              title={t.label}
              className={`cd-tab ${active ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} />
            </button>
          )
        })}
      </nav>

      {/* Split-pane: content + PDF */}
      <div className="cd-split">
        <div className="cd-content">
          {!contrato && loading && <div className="cd-loading">A carregar…</div>}

          {contrato && tab === 'resumo' && (
            <div className="cd-stack">
              <ResumoIdentificacao contrato={contrato} />
              <ResumoPartes contratoId={contrato.id} />
              <ResumoCompliance contratoId={contrato.id} />
              <ResumoProximosEventos contratoId={contrato.id} />
              <ResumoCustomFields contratoId={contrato.id} />
            </div>
          )}

          {contrato && tab === 'termos' && (
            <div className="cd-stack">
              <EditorTab contratoId={contrato.id} />
            </div>
          )}

          {contrato && tab === 'eventos' && (
            <div className="cd-stack">
              <ObrigacoesTab contratoId={contrato.id} />
              <ComplianceTab contratoId={contrato.id} />
            </div>
          )}

          {contrato && tab === 'documentos' && (
            <div className="cd-stack">
              <VersoesTab contratoId={contrato.id} />
              <DocumentosTab contratoId={contrato.id} />
            </div>
          )}

          {contrato && tab === 'conversa' && (
            <div className="cd-stack">
              <Placeholder
                title="Conversa & histórico"
                hint="Comentários por cláusula + timeline de eventos. Em consolidação na Sprint 2.4."
              />
            </div>
          )}
        </div>

        <aside className="cd-pdf">
          {contrato && <PdfPreview contratoId={contrato.id} />}
        </aside>
      </div>

      <style jsx>{`
        .cd-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: calc(100vh - 100px);
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
        .cd-back:hover {
          color: var(--k2-text-dim);
        }
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
        .cd-numero {
          color: var(--k2-text-dim);
        }
        .cd-dot {
          color: var(--k2-text-mute);
          opacity: 0.6;
        }
        .cd-prox {
          color: var(--k2-text-dim);
        }
        .cd-prox.urgent {
          color: var(--k2-warn);
          font-weight: 500;
        }
        .cd-hero-actions {
          display: inline-flex;
          gap: 6px;
          flex-shrink: 0;
        }
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
        .cd-btn-soft {
          background: var(--k2-bg-elev);
          color: var(--k2-text-dim);
        }
        .cd-btn-soft:hover {
          background: var(--k2-bg-hover);
          color: var(--k2-text);
        }
        .cd-btn-primary {
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border-color: var(--k2-accent);
        }
        .cd-btn-primary:hover {
          opacity: 0.9;
        }
        .cd-btn-icon {
          padding: 6px;
        }

        .cd-tabs {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid var(--k2-border);
          padding-bottom: 1px;
        }
        .cd-tab {
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          color: var(--k2-text-mute);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .cd-tab:hover {
          color: var(--k2-text-dim);
        }
        .cd-tab.active {
          color: var(--k2-text);
          border-bottom-color: var(--k2-text);
        }

        .cd-split {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
          flex: 1;
          min-height: 0;
        }
        @media (max-width: 1100px) {
          .cd-split {
            grid-template-columns: 1fr;
          }
          .cd-pdf {
            min-height: 480px;
          }
        }
        .cd-content {
          min-width: 0;
        }
        .cd-pdf {
          position: sticky;
          top: 16px;
          align-self: flex-start;
          height: calc(100vh - 180px);
          min-height: 600px;
        }
        @media (max-width: 1100px) {
          .cd-pdf {
            position: static;
            height: auto;
          }
        }
        .cd-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cd-loading {
          color: var(--k2-text-mute);
          font-size: 13px;
          padding: 12px;
        }
      `}</style>
    </div>
  )
}

/**
 * Sugere a próxima acção a partir do estado + datas. Hint curto que
 * vai à hero strip, para o utilizador saber em 1 segundo o que importa.
 */
function proximaAccaoHint(c: Contrato): { text: string; urgent: boolean } | null {
  const now = new Date()
  if (c.dataTermo) {
    const termo = new Date(c.dataTermo)
    const dias = Math.ceil(
      (termo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (dias < 0) {
      return { text: `Termo expirou há ${Math.abs(dias)} dias`, urgent: true }
    }
    if (dias === 0) {
      return { text: `Termo hoje`, urgent: true }
    }
    if (dias <= 30) {
      const tipoTermo = c.renovacaoAutomatica ? 'Renova' : 'Termina'
      return { text: `${tipoTermo} em ${dias} dias`, urgent: dias <= 7 }
    }
  }
  if (c.estado === ContratoEstado.PRONTO_ASSINATURA) {
    return { text: 'Pronto para assinatura', urgent: true }
  }
  if (
    c.estado === ContratoEstado.DRAFTING ||
    c.estado === ContratoEstado.REV_INTERNA
  ) {
    return { text: 'Em redacção', urgent: false }
  }
  return null
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{
      background: 'var(--k2-bg-elev)',
      border: '1px solid var(--k2-border)',
      borderRadius: 'var(--k2-radius)',
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--k2-text)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--k2-text-mute)', marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
    </div>
  )
}
