'use client'

/**
 * Kamaia AI — Homepage.
 *
 * Substitui o Dashboard tradicional como landing page após login.
 * Razão: o agente é a interface universal. Quem prefere a vista
 * estatística do dashboard navega para /dashboard.
 *
 * Layout:
 *  - Vazio: hero centrado com saudação + input + chips contextuais
 *  - Com conversa: o thread renderiza INLINE na própria página (não
 *    abre o painel lateral — seria redundante estar já na página
 *    dedicada da Kamaia AI), com input fixo em baixo e "Nova conversa"
 *
 * Implementação: partilha o mesmo provider que o painel lateral (⌘+J)
 * via context — `messages`, `send`, `newConversation`. Reutiliza o
 * componente <Message> exportado pelo painel para render idêntico.
 */

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Sparkles,
  Send,
  Calendar,
  TrendingUp,
  Bell,
  FilePlus,
  LayoutDashboard,
  Command,
  Plus,
} from 'lucide-react'
import { useKamaiaAI, useKamaiaPageContext } from '@/components/kamaia-ai/kamaia-ai-provider'
import { Message } from '@/components/kamaia-ai/kamaia-ai-panel'
import { FirstRunBanner } from '@/components/onboarding/first-run-banner'

interface Chip {
  icon: React.ElementType
  label: string
  prompt: string
}

const CHIPS: Chip[] = [
  {
    icon: Bell,
    label: 'O que está pendente?',
    prompt:
      'Que contratos têm obrigações em atraso ou actos regulatórios pendentes? Devolve uma lista accionável.',
  },
  {
    icon: Calendar,
    label: 'Próximos 30 dias',
    prompt:
      'Que datas-chave (termos, renovações, denúncias, pagamentos) vencem nos próximos 30 dias?',
  },
  {
    icon: TrendingUp,
    label: 'Top contratos por valor',
    prompt:
      'Quais são os 5 contratos activos com maior valor anual? Inclui contraparte e termo.',
  },
  {
    icon: FilePlus,
    label: 'Criar um contrato',
    prompt:
      'Quero criar um contrato. Guia-me com perguntas — preciso de título, tipo, contraparte, valor e datas.',
  },
]

export default function KamaiaAIHomePage() {
  const { data: session } = useSession()
  // A conversa decorre INLINE nesta página — partilha o mesmo provider
  // que o painel lateral (⌘+J), mas aqui NÃO abrimos o painel: seria
  // redundante estar já na página dedicada da Kamaia AI.
  const { send, sending, messages, newConversation } = useKamaiaAI()
  const [input, setInput] = useState('')

  // Declara o contexto desta page para o agente
  useKamaiaPageContext({ type: 'home' })

  const hasThread = messages.length > 0
  const threadRef = useRef<HTMLDivElement>(null)

  // Auto-scroll para a última mensagem enquanto chega conteúdo.
  useEffect(() => {
    if (!hasThread) return
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, hasThread])

  const firstName = session?.user?.firstName ?? 'Olá'
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const submit = async (text: string) => {
    if (!text.trim() || sending) return
    setInput('')
    await send(text.trim())
  }

  const inputForm = (
    <form
      className="kai-home-form"
      onSubmit={(e) => {
        e.preventDefault()
        void submit(input)
      }}
    >
      <input
        className="kai-home-input"
        placeholder="Pergunta à Kamaia AI…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={sending}
        autoFocus
        aria-label="Pergunta à Kamaia AI"
      />
      <button
        type="submit"
        className="kai-home-send"
        disabled={!input.trim() || sending}
        aria-label="Enviar"
        title="Enviar (Enter)"
      >
        <Send size={16} />
      </button>
    </form>
  )

  return (
    <div className={`kai-home ${hasThread ? 'threaded' : ''}`}>
      {hasThread ? (
        <div className="kai-conv">
          <div className="kai-conv-head">
            <span className="kai-conv-title">
              <Sparkles size={14} /> Kamaia AI
            </span>
            <button
              type="button"
              className="kai-conv-new"
              onClick={() => void newConversation()}
              title="Começar nova conversa"
            >
              <Plus size={13} /> Nova conversa
            </button>
          </div>
          <div className="kai-thread" ref={threadRef}>
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
          <div className="kai-conv-foot">
            {inputForm}
            <div className="kai-conv-hint">
              Kamaia AI pode cometer erros. Verifica informação crítica.
            </div>
          </div>
        </div>
      ) : (
        <div className="kai-home-inner">
          <div className="kai-home-hero">
            <Sparkles size={32} className="kai-home-spark" />
            <h1 className="kai-home-title">
              {greeting}, <span>{firstName}</span>.
            </h1>
            <p className="kai-home-sub">
              Pergunta sobre contratos, datas, compliance angolano — ou pede
              para criar, abrir, atualizar. Eu trato do resto.
            </p>
          </div>

          {inputForm}

          <div className="kai-home-chips">
            {CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                className="kai-home-chip"
                onClick={() => void submit(c.prompt)}
                disabled={sending}
              >
                <c.icon size={14} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <FirstRunBanner />

          <div className="kai-home-secondary">
            <span className="kai-home-hint">
              <Command size={11} /> +J abre o painel em qualquer página
            </span>
            <Link href="/dashboard" className="kai-home-link">
              <LayoutDashboard size={12} /> Dashboard clássico
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .kai-home {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 120px);
          padding: 40px 24px;
        }
        /* Modo conversa: thread ocupa a página, input fixo em baixo. */
        .kai-home.threaded {
          align-items: stretch;
          justify-content: flex-start;
          padding: 0;
          min-height: 0;
          height: calc(100vh - 116px);
        }
        .kai-conv {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100%;
        }
        .kai-conv-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px 10px;
        }
        .kai-conv-title {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .kai-conv-new {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: inherit;
          font-size: 12px;
          color: var(--k2-text-mute);
          background: transparent;
          border: 1px solid var(--k2-border);
          border-radius: 8px;
          padding: 5px 10px;
          cursor: pointer;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .kai-conv-new:hover {
          color: var(--k2-text);
          border-color: var(--k2-border-strong);
        }
        .kai-thread {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 12px 20px 20px;
        }
        .kai-conv-foot {
          padding: 8px 20px 16px;
          border-top: 1px solid var(--k2-border);
          background: var(--k2-bg);
        }
        .kai-conv-foot .kai-home-form {
          margin-top: 8px;
        }
        .kai-conv-hint {
          text-align: center;
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-top: 8px;
        }
        .kai-home-inner {
          width: 100%;
          max-width: 720px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .kai-home-hero {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .kai-home-spark {
          color: var(--k2-text-mute);
          margin-bottom: 4px;
        }
        .kai-home-title {
          margin: 0;
          font-size: 32px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--k2-text);
          line-height: 1.2;
        }
        .kai-home-title span {
          color: var(--k2-text-dim);
        }
        .kai-home-sub {
          margin: 0;
          font-size: 14px;
          color: var(--k2-text-mute);
          line-height: 1.5;
          max-width: 480px;
        }

        .kai-home-form {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 8px 8px 20px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border-strong);
          border-radius: 14px;
          box-shadow: 0 4px 14px -8px rgba(0, 0, 0, 0.08);
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .kai-home-form:focus-within {
          border-color: var(--k2-text);
          box-shadow: 0 4px 18px -6px rgba(0, 0, 0, 0.14);
        }
        .kai-home-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--k2-text);
          font-family: inherit;
          font-size: 15px;
          padding: 12px 0;
        }
        .kai-home-input::placeholder {
          color: var(--k2-text-mute);
        }
        .kai-home-send {
          display: inline-grid;
          place-items: center;
          width: 40px;
          height: 40px;
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 120ms ease;
        }
        .kai-home-send:hover:not(:disabled) {
          opacity: 0.85;
        }
        .kai-home-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .kai-home-chips {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 540px) {
          .kai-home-chips {
            grid-template-columns: 1fr;
          }
        }
        .kai-home-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 14px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: 10px;
          color: var(--k2-text-dim);
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 120ms ease, border-color 120ms ease,
            color 120ms ease;
        }
        .kai-home-chip:hover:not(:disabled) {
          background: var(--k2-bg-hover);
          border-color: var(--k2-border-strong);
          color: var(--k2-text);
        }
        .kai-home-chip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .kai-home-chip span {
          flex: 1;
        }

        .kai-home-secondary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: var(--k2-text-mute);
          padding-top: 8px;
        }
        .kai-home-hint {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .kai-home-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--k2-text-mute);
          text-decoration: none;
          transition: color 120ms ease;
        }
        .kai-home-link:hover {
          color: var(--k2-text);
        }
      `}</style>
    </div>
  )
}
