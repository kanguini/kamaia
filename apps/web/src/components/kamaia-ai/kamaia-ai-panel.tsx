'use client'

/**
 * KamaiaAIPanel — side panel persistente (não-modal) para o assistente.
 *
 * Decisões de design:
 *  - **Não-modal:** sem backdrop a tapar a página. O utilizador continua
 *    a interagir com o conteúdo principal enquanto a IA responde.
 *  - **Width 420px:** suficiente para chat confortável; não rouba muita
 *    largura ao conteúdo. Em mobile (<768px) ocupa quase toda a largura.
 *  - **Sticky right:** entra com slide e fica até ser fechado.
 *  - **ESC fecha** quando o foco está no input do panel (controlado aqui,
 *    o provider lida com o atalho global ⌘+J).
 *
 * Composição:
 *  - Header: título + selector de conversa + acções (nova, fechar)
 *  - Body: lista de mensagens com streaming + citações
 *  - Footer: input + send
 */

import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  Send,
  X,
  BookOpen,
  ChevronDown,
  Sparkles,
  Trash2,
  History,
  Wrench,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Square,
} from 'lucide-react'
import Link from 'next/link'
import { useKamaiaAI } from './kamaia-ai-provider'
import type { ToolCallTrace } from './types'
import { renderMarkdownPreview } from '@/lib/markdown'
import { fmtDateTime } from '@/lib/clm-format'

const PANEL_WIDTH = 420

export function KamaiaAIPanel() {
  const {
    open,
    setOpen,
    conversations,
    conversationId,
    selectConversation,
    newConversation,
    deleteConversation,
    messages,
    send,
    sending,
    stop,
  } = useKamaiaAI()

  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll quando mensagens mudam — Onda C.1.1.
  // Só auto-scroll se o utilizador já está perto do fim. Se ele
  // scrollou para cima para ler citações antigas, NÃO o puxamos
  // de volta a cada delta do stream.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const threshold = 80 // px de tolerância
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (nearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Foca o input quando o panel abre — Onda C.1.1.
  // setTimeout cleanup: se o panel toggle rapidamente, o focus
  // pendente roubava foco do destino seguinte.
  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(handle)
  }, [open])

  // ESC fecha (apenas quando foco está dentro do panel)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null
        if (target?.closest('[data-kamaia-ai-panel]')) {
          e.preventDefault()
          setOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await send(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const activeConv = conversations.find((c) => c.id === conversationId)

  return (
    <>
      <div
        data-kamaia-ai-panel
        className={`kai-panel ${open ? 'open' : ''}`}
        aria-hidden={!open}
        // Onda C.1.3: `inert` desabilita interacção + tira do tab
        // order quando o panel está fechado. aria-hidden sozinho
        // protegia screen readers mas Tab key ainda atingia os
        // botões/inputs internos.
        {...(!open ? { inert: '' as never } : {})}
        role="complementary"
        aria-label="Dr. Kamaia"
      >
        {/* Header */}
        <div className="kai-head">
          <div className="kai-title">
            <Sparkles size={14} />
            <span>Dr. Kamaia</span>
          </div>
          <div className="kai-head-actions">
            <button
              type="button"
              className="kai-icon-btn"
              onClick={() => setShowHistory((v) => !v)}
              aria-label="Histórico de conversas"
              title="Histórico"
            >
              <History size={14} />
            </button>
            <button
              type="button"
              className="kai-icon-btn"
              onClick={() => void newConversation()}
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="kai-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              title="Fechar (⌘+J)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Conversation indicator */}
        {activeConv && !showHistory && (
          <button
            type="button"
            className="kai-conv-indicator"
            onClick={() => setShowHistory(true)}
            title="Mudar conversa"
          >
            <span className="kai-conv-title">{activeConv.title || 'Sem título'}</span>
            <ChevronDown size={11} />
          </button>
        )}

        {/* History overlay (in-panel) */}
        {showHistory && (
          <div className="kai-history">
            <div className="kai-history-head">
              <span>Conversas</span>
              <button
                type="button"
                className="kai-icon-btn"
                onClick={() => setShowHistory(false)}
                aria-label="Fechar histórico"
              >
                <X size={12} />
              </button>
            </div>
            <div className="kai-history-list">
              {conversations.length === 0 && (
                <div className="kai-history-empty">Ainda sem conversas. Pergunta algo abaixo para começar.</div>
              )}
              {conversations.map((c) => {
                const isActive = c.id === conversationId
                return (
                  <div
                    key={c.id}
                    className={`kai-history-item ${isActive ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectConversation(c.id)
                        setShowHistory(false)
                      }}
                      className="kai-history-item-main"
                    >
                      <div className="kai-history-item-title">
                        {c.title || 'Sem título'}
                      </div>
                      <div className="kai-history-item-date">
                        {fmtDateTime(c.updatedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(c.id)}
                      className="kai-icon-btn kai-history-item-del"
                      aria-label="Apagar conversa"
                      title="Apagar"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Body — messages list */}
        <div
          ref={listRef}
          className="kai-body"
          aria-live="polite"
          aria-atomic="false"
        >
          {messages.length === 0 && !showHistory && (
            <div className="kai-empty">
              <Sparkles size={24} className="kai-empty-icon" />
              <div className="kai-empty-title">Como posso ajudar?</div>
              <div className="kai-empty-sub">
                Pergunta sobre contratos e legislação angolana, ou pede para
                criar, abrir ou actualizar contratos.
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}
        </div>

        {/* Footer — input */}
        <form
          className="kai-foot"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSend()
          }}
        >
          <textarea
            ref={inputRef}
            className="kai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunta ao Dr. Kamaia…"
            rows={1}
            disabled={sending}
            aria-label="Escreve uma mensagem"
          />
          {sending ? (
            <button
              type="button"
              className="kai-send kai-stop"
              onClick={stop}
              aria-label="Parar resposta"
              title="Parar"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="kai-send"
              disabled={!input.trim()}
              aria-label="Enviar"
              title="Enviar (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </form>
        <div className="kai-foot-hint">
          O Dr. Kamaia pode cometer erros. Verifica informação crítica.
        </div>
      </div>

      <style jsx>{`
        .kai-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: ${PANEL_WIDTH}px;
          max-width: 100vw;
          background: var(--k2-bg-elev);
          border-left: 1px solid var(--k2-border);
          box-shadow: -12px 0 32px -16px rgba(0, 0, 0, 0.18);
          transform: translateX(100%);
          transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          z-index: 40;
          pointer-events: none;
        }
        .kai-panel.open {
          transform: translateX(0);
          pointer-events: auto;
        }

        .kai-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--k2-border);
          flex-shrink: 0;
        }
        .kai-title {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .kai-head-actions {
          display: inline-flex;
          gap: 2px;
        }
        .kai-icon-btn {
          display: inline-grid;
          place-items: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          color: var(--k2-text-dim);
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
        }
        .kai-icon-btn:hover {
          background: var(--k2-bg-hover);
          color: var(--k2-text);
        }

        .kai-conv-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin: 8px 12px 0;
          padding: 5px 10px;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          color: var(--k2-text-dim);
          border-radius: 999px;
          font-size: 11px;
          cursor: pointer;
          align-self: flex-start;
          max-width: calc(100% - 24px);
        }
        .kai-conv-indicator:hover {
          color: var(--k2-text);
        }
        .kai-conv-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }

        .kai-history {
          position: absolute;
          inset: 49px 0 70px 0;
          background: var(--k2-bg-elev);
          z-index: 2;
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--k2-border);
        }
        .kai-history-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--k2-text-mute);
          border-bottom: 1px solid var(--k2-border);
        }
        .kai-history-list {
          flex: 1;
          overflow-y: auto;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .kai-history-empty {
          padding: 14px;
          font-size: 12px;
          color: var(--k2-text-mute);
          text-align: center;
        }
        .kai-history-item {
          display: flex;
          align-items: stretch;
          border-radius: var(--k2-radius-sm);
          transition: background 120ms ease;
        }
        .kai-history-item:hover {
          background: var(--k2-bg-hover);
        }
        .kai-history-item.active {
          background: var(--k2-bg-elev-2);
        }
        .kai-history-item-main {
          flex: 1;
          text-align: left;
          background: transparent;
          border: none;
          padding: 8px 10px;
          color: var(--k2-text);
          cursor: pointer;
          min-width: 0;
        }
        .kai-history-item-title {
          font-size: 12px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .kai-history-item-date {
          font-size: 10px;
          color: var(--k2-text-mute);
          margin-top: 2px;
        }
        .kai-history-item-del {
          width: 26px;
          margin: 4px;
        }

        .kai-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }
        .kai-empty {
          margin: auto;
          text-align: center;
          padding: 20px;
        }
        .kai-empty-icon {
          color: var(--k2-text-mute);
          margin-bottom: 10px;
        }
        .kai-empty-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--k2-text);
          margin-bottom: 6px;
        }
        .kai-empty-sub {
          font-size: 12px;
          color: var(--k2-text-mute);
          line-height: 1.5;
        }

        .kai-foot {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          padding: 10px 12px 4px;
          border-top: 1px solid var(--k2-border);
          flex-shrink: 0;
        }
        .kai-input {
          flex: 1;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          padding: 9px 12px;
          color: var(--k2-text);
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
          resize: none;
          min-height: 36px;
          max-height: 160px;
          outline: none;
          transition: border-color 120ms ease;
        }
        .kai-input:focus {
          border-color: var(--k2-border-strong);
        }
        .kai-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .kai-send {
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border: none;
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          transition: opacity 120ms ease;
          flex-shrink: 0;
        }
        .kai-send:hover:not(:disabled) {
          opacity: 0.85;
        }
        .kai-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .kai-stop {
          background: var(--k2-bg-elev-2);
          color: var(--k2-text);
          border: 1px solid var(--k2-border-strong);
        }
        .kai-foot-hint {
          padding: 0 14px 10px;
          font-size: 10px;
          color: var(--k2-text-mute);
          text-align: center;
        }

        @media (max-width: 768px) {
          .kai-panel {
            width: 100vw;
            border-left: none;
          }
        }
      `}</style>
    </>
  )
}

/**
 * ToolCallChip — visualiza o estado de uma tool invocada pelo agente.
 *
 * Estados:
 *  - starting/executing: spinner + nome
 *  - done: ✓ + nome + items clicáveis (se renderHint=list)
 *  - error: ⚠ + mensagem
 */
function ToolCallChip({ trace }: { trace: ToolCallTrace }) {
  const { send, sending } = useKamaiaAI()
  const [acted, setActed] = useState<null | 'confirm' | 'cancel'>(null)
  const isConfirmation = trace.renderHint === 'confirmation'
  const isRunning = trace.status === 'starting' || trace.status === 'executing'
  // Confirmação chega como tool_result is_error, mas não é um erro real.
  const isError = trace.status === 'error' && !isConfirmation
  const items = trace.uiPayload?.items

  return (
    <div
      className={`kai-tool ${isRunning ? 'running' : ''} ${isError ? 'error' : ''} ${isConfirmation ? 'confirm' : ''}`}
    >
      <div className="kai-tool-head">
        <Wrench size={11} />
        <span className="kai-tool-name">{prettyToolName(trace.name)}</span>
        <span className="kai-tool-state">
          {isRunning && 'a executar…'}
          {trace.status === 'done' && '✓'}
          {isError && '⚠'}
          {isConfirmation && 'requer confirmação'}
        </span>
      </div>
      {isConfirmation && (
        <div className="kai-tool-confirm" role="group" aria-label="Confirmar acção">
          <div className="kai-tool-confirm-head">
            <AlertTriangle size={13} className="kai-tool-confirm-icon" />
            <span>Confirmar acção</span>
          </div>
          <div className="kai-tool-confirm-summary">
            {confirmSummary(trace.uiPayload)}
          </div>
          {acted === null ? (
            <div className="kai-tool-confirm-actions">
              <button
                type="button"
                className="kai-confirm-yes"
                disabled={sending}
                onClick={() => {
                  setActed('confirm')
                  void send('Sim, confirmo.', { allowMutations: true })
                }}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="kai-confirm-no"
                disabled={sending}
                onClick={() => {
                  setActed('cancel')
                  void send('Cancela, por favor.')
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="kai-tool-confirm-done" role="status">
              {acted === 'cancel'
                ? 'Cancelado.'
                : sending
                  ? 'A confirmar…'
                  : 'Confirmação enviada.'}
            </div>
          )}
        </div>
      )}
      {isError && trace.errorMessage && (
        <div className="kai-tool-err">{trace.errorMessage}</div>
      )}
      {items && items.length > 0 && (
        <div className="kai-tool-items">
          {items.slice(0, 6).map((it) =>
            it.href ? (
              <Link key={it.id} href={it.href} className="kai-tool-item">
                <div className="kai-tool-item-label">{it.label}</div>
                {it.sublabel && (
                  <div className="kai-tool-item-sub">{it.sublabel}</div>
                )}
                <ChevronRight size={11} className="kai-tool-item-arrow" />
              </Link>
            ) : (
              <div key={it.id} className="kai-tool-item">
                <div className="kai-tool-item-label">{it.label}</div>
                {it.sublabel && (
                  <div className="kai-tool-item-sub">{it.sublabel}</div>
                )}
              </div>
            ),
          )}
          {items.length > 6 && (
            <div className="kai-tool-more">+{items.length - 6} mais</div>
          )}
        </div>
      )}
      <style jsx>{`
        .kai-tool {
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          padding: 8px 10px;
        }
        .kai-tool.running {
          border-color: var(--k2-border-strong);
        }
        .kai-tool.error {
          border-color: var(--k2-bad);
        }
        .kai-tool.confirm {
          border-color: var(--k2-warn);
          border-width: 1.5px;
          background: color-mix(in srgb, var(--k2-warn) 8%, var(--k2-bg-elev));
        }
        .kai-tool-confirm {
          margin-top: 8px;
        }
        .kai-tool-confirm-head {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--k2-warn);
          margin-bottom: 7px;
        }
        .kai-tool-confirm-icon {
          flex-shrink: 0;
        }
        .kai-tool-confirm-summary {
          margin-bottom: 9px;
        }
        .kai-confirm-action {
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
          margin-bottom: 5px;
        }
        .kai-confirm-fields {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .kai-confirm-field {
          display: flex;
          gap: 8px;
          font-size: 11.5px;
        }
        .kai-confirm-field dt {
          color: var(--k2-text-mute);
          min-width: 78px;
          flex-shrink: 0;
        }
        .kai-confirm-field dd {
          margin: 0;
          color: var(--k2-text);
          font-weight: 500;
        }
        .kai-confirm-note {
          font-size: 12px;
          color: var(--k2-text);
        }
        .kai-tool-confirm-actions {
          display: flex;
          gap: 7px;
        }
        .kai-confirm-yes,
        .kai-confirm-no {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          border: 1px solid transparent;
        }
        .kai-confirm-yes {
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
        }
        .kai-confirm-yes:disabled,
        .kai-confirm-no:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .kai-confirm-no {
          background: transparent;
          border-color: var(--k2-border-strong);
          color: var(--k2-text-dim);
        }
        .kai-tool-confirm-done {
          font-size: 12px;
          color: var(--k2-text-mute);
        }
        .kai-tool-head {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--k2-text);
          font-weight: 500;
        }
        .kai-tool-name {
          letter-spacing: 0.01em;
        }
        .kai-tool-state {
          font-weight: 400;
          color: var(--k2-text-mute);
          margin-left: 4px;
          font-size: 10px;
        }
        .kai-tool-err {
          font-size: 11px;
          color: var(--k2-bad);
          margin-top: 4px;
        }
        .kai-tool-items {
          margin-top: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .kai-tool-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          font-size: 12px;
          text-decoration: none;
          transition: background 120ms ease, border-color 120ms ease;
        }
        a.kai-tool-item:hover {
          background: var(--k2-bg-hover);
          border-color: var(--k2-border-strong);
        }
        .kai-tool-item-label {
          flex: 1;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .kai-tool-item-sub {
          font-size: 10px;
          color: var(--k2-text-mute);
          margin-top: 1px;
        }
        .kai-tool-item-arrow {
          color: var(--k2-text-mute);
        }
        .kai-tool-more {
          font-size: 10px;
          color: var(--k2-text-mute);
          text-align: center;
          padding: 4px;
        }
      `}</style>
    </div>
  )
}

/** Mapeia tool name técnico para label humano em pt-AO. */
function prettyToolName(name: string): string {
  const map: Record<string, string> = {
    find_contratos: 'A pesquisar contratos',
    find_entidades: 'A pesquisar entidades',
    open_contrato: 'A abrir contrato',
    list_datas_chave: 'A consultar datas-chave',
    list_obrigacoes: 'A consultar obrigações',
    create_contrato: 'A criar contrato',
    find_or_create_entidade: 'A criar entidade',
  }
  return map[name] ?? name
}

// Rótulos amigáveis para os argumentos da acção proposta no card de
// confirmação. Só mostramos campos legíveis e ignoramos UUIDs/ruído.
const ARG_LABELS: Record<string, string> = {
  titulo: 'Título',
  nome: 'Nome',
  query: 'Nome',
  valor: 'Valor',
  moeda: 'Moeda',
  leiAplicavel: 'Lei aplicável',
  foro: 'Foro',
  dataInicioVigencia: 'Início',
  dataTermo: 'Termo',
  descricao: 'Descrição',
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resumo legível da acção que vai ser executada, a partir do uiPayload
 * { toolName, args } que o backend envia no CONFIRMATION_REQUIRED. Sem
 * isto, o utilizador confirmava às cegas.
 */
function confirmSummary(uiPayload: ToolCallTrace['uiPayload']): React.ReactNode {
  const toolName = uiPayload?.toolName
  const args = uiPayload?.args ?? {}
  const titulo = prettyToolName(toolName ?? '').replace(/^A /, '')
  const linhas: Array<{ k: string; v: string }> = []
  for (const [key, label] of Object.entries(ARG_LABELS)) {
    const raw = (args as Record<string, unknown>)[key]
    if (raw === undefined || raw === null || raw === '') continue
    if (typeof raw === 'string' && UUID_RE.test(raw)) continue
    let v: string
    if (key === 'valor' && (typeof raw === 'number' || typeof raw === 'string')) {
      const n = Number(raw)
      v = Number.isFinite(n) ? `${n.toLocaleString('pt-PT')} ${String((args as Record<string, unknown>).moeda ?? 'AOA')}` : String(raw)
      if (key === 'valor') linhas.push({ k: label, v })
      continue
    }
    if (key === 'moeda') continue // já incluída no valor
    v = String(raw)
    if (v.length > 80) v = v.slice(0, 80) + '…'
    linhas.push({ k: label, v })
  }
  const partes = (args as Record<string, unknown>).partes
  if (Array.isArray(partes) && partes.length > 0) {
    linhas.push({ k: 'Partes', v: `${partes.length}` })
  }
  return (
    <>
      <div className="kai-confirm-action">
        {titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : 'Acção'}
      </div>
      {linhas.length > 0 ? (
        <dl className="kai-confirm-fields">
          {linhas.map((l) => (
            <div key={l.k} className="kai-confirm-field">
              <dt>{l.k}</dt>
              <dd>{l.v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="kai-confirm-note">Esta acção altera dados.</div>
      )}
    </>
  )
}

export function Message({ message: m }: { message: import('./types').Message }) {
  const { retry, sending } = useKamaiaAI()
  const isUser = m.role === 'user'
  // Render assistant content as markdown; user fica como plain text para
  // preservar a forma como ele escreveu (incluindo erros tipográficos).
  const html = !isUser && m.content ? renderMarkdownPreview(m.content) : null
  const hasToolCalls = !isUser && m.toolCalls && m.toolCalls.length > 0
  // "A pensar" só enquanto não há texto NEM tools a correr (essas já
  // comunicam actividade pelo próprio chip).
  const showThinking = m.streaming && !isUser && !m.content && !hasToolCalls
  // Bolha vazia settled (sem conteúdo, sem tools, terminou) não deve
  // renderizar — colapsa.
  const showBubble = isUser || html || showThinking

  return (
    <div className={`kai-msg ${isUser ? 'user' : 'assistant'}`}>
      {hasToolCalls && (
        <div className="kai-tools">
          {m.toolCalls!.map((tc) => (
            <ToolCallChip key={tc.id} trace={tc} />
          ))}
        </div>
      )}
      {showBubble && (
        <div className={`kai-bubble ${m.errored ? 'errored' : ''}`}>
          {isUser ? (
            <span className="kai-bubble-text">{m.content}</span>
          ) : html ? (
            <div
              className="kai-bubble-md"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <span className="kai-thinking" aria-label="Dr. Kamaia a pensar">
              Dr. Kamaia a pensar<span className="kai-dots" aria-hidden="true" />
            </span>
          )}
          {m.streaming && !isUser && m.content && <span className="kai-caret" />}
        </div>
      )}
      {m.errored && !isUser && (
        <button
          type="button"
          className="kai-retry"
          disabled={sending}
          onClick={() => retry()}
        >
          <RotateCcw size={12} /> Repetir
        </button>
      )}
      {!isUser && m.citacoes && m.citacoes.length > 0 && (
        <div className="kai-citations">
          <div className="kai-citations-head">
            <BookOpen size={10} />
            <span>Citações</span>
          </div>
          {m.citacoes.map((c, i) => (
            <div key={i} className="kai-citation">
              <div className="kai-citation-ref">
                {c.documentCodigo}
                {c.artigo ? ` art. ${c.artigo}` : ''}
              </div>
              <div className="kai-citation-title">{c.titulo}</div>
              <div className="kai-citation-trecho">
                &ldquo;{c.trecho.slice(0, 180)}…&rdquo;
              </div>
            </div>
          ))}
        </div>
      )}
      <style jsx>{`
        .kai-msg {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: ${isUser ? 'flex-end' : 'flex-start'};
        }
        .kai-bubble {
          max-width: 92%;
          padding: 10px 13px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.55;
          word-wrap: break-word;
          ${isUser
            ? `
              background: var(--k2-accent);
              color: var(--k2-accent-fg);
              border-bottom-right-radius: 4px;
            `
            : `
              background: var(--k2-bg-elev-2);
              color: var(--k2-text);
              border-bottom-left-radius: 4px;
            `}
        }
        .kai-bubble-text {
          white-space: pre-wrap;
        }
        .kai-bubble.errored {
          border: 1px solid var(--k2-bad);
        }
        .kai-thinking {
          color: var(--k2-text-mute);
          font-size: 13px;
        }
        .kai-dots::after {
          content: '…';
          animation: kai-thinking-dots 1.4s steps(4, end) infinite;
        }
        @keyframes kai-thinking-dots {
          0% { content: ''; }
          25% { content: '.'; }
          50% { content: '..'; }
          75% { content: '…'; }
        }
        .kai-retry {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: inherit;
          font-size: 12px;
          color: var(--k2-text-dim);
          background: transparent;
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          padding: 5px 10px;
          margin-top: 6px;
          cursor: pointer;
        }
        .kai-retry:hover:not(:disabled) {
          color: var(--k2-text);
          border-color: var(--k2-border-strong);
        }
        .kai-retry:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .kai-caret {
          display: inline-block;
          width: 6px;
          height: 12px;
          background: var(--k2-text-dim);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: kai-blink 1s infinite;
        }
        @keyframes kai-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .kai-citations {
          max-width: 92%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .kai-citations-head {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--k2-text-mute);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .kai-citation {
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          padding: 6px 10px;
          font-size: 11px;
        }
        .kai-citation-ref {
          font-weight: 500;
          color: var(--k2-text);
        }
        .kai-citation-title {
          color: var(--k2-text-mute);
          margin-top: 2px;
        }
        .kai-citation-trecho {
          color: var(--k2-text-dim);
          margin-top: 4px;
          font-style: italic;
        }
        .kai-tools {
          max-width: 92%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .kai-bubble-md :global(p) {
          margin: 0 0 8px 0;
        }
        .kai-bubble-md :global(p:last-child) {
          margin-bottom: 0;
        }
        .kai-bubble-md :global(ul),
        .kai-bubble-md :global(ol) {
          margin: 0 0 8px 0;
          padding-left: 20px;
        }
        .kai-bubble-md :global(li) {
          margin-bottom: 2px;
        }
        .kai-bubble-md :global(h2),
        .kai-bubble-md :global(h3) {
          font-size: 13px;
          margin: 8px 0 4px;
          font-weight: 600;
        }
        .kai-bubble-md :global(code) {
          background: var(--k2-bg);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .kai-bubble-md :global(pre) {
          background: var(--k2-bg);
          padding: 8px 10px;
          border-radius: var(--k2-radius-sm);
          overflow-x: auto;
          font-size: 11px;
          margin: 0 0 8px 0;
        }
        .kai-bubble-md :global(a) {
          color: var(--k2-text);
          text-decoration: underline;
        }
        .kai-bubble-md :global(strong) {
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
