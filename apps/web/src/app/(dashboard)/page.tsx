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
import {
  Sparkles,
  Send,
  Calendar,
  Scale,
  Bell,
  FileSearch,
  Plus,
  Square,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useKamaiaAI, useKamaiaPageContext } from '@/components/kamaia-ai/kamaia-ai-provider'
import { FirstRunBanner } from '@/components/onboarding/first-run-banner'

// O <Message> vive no painel (markdown, tool chips). Só é preciso
// quando há conversa activa — carrega-o sob demanda para não pesar o
// bundle inicial da homepage (hidratação rápida, sem FOUC visível).
const Message = dynamic(
  () => import('@/components/kamaia-ai/kamaia-ai-panel').then((m) => m.Message),
  { ssr: false },
)

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
    icon: Scale,
    label: 'Consultar a lei',
    prompt:
      'Quero consultar a legislação angolana sobre um tema. Pergunta-me qual e depois cita o diploma e o artigo aplicáveis.',
  },
  {
    icon: FileSearch,
    label: 'Resumir um contrato',
    prompt:
      'Dá-me um resumo de um contrato à minha escolha — partes, valor, datas-chave, obrigações e riscos a vigiar. Pergunta-me qual.',
  },
]

export default function KamaiaAIHomePage() {
  const { data: session } = useSession()
  // A conversa decorre INLINE nesta página — partilha o mesmo provider
  // que o painel lateral (⌘+J), mas aqui NÃO abrimos o painel: seria
  // redundante estar já na página dedicada da Kamaia AI.
  const { send, sending, messages, newConversation, stop } = useKamaiaAI()

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

  const inputForm = (
    <HomeComposer sending={sending} onSend={send} onStop={stop} />
  )

  return (
    <div className={`kai-home ${hasThread ? 'threaded' : ''}`}>
      {hasThread ? (
        <div className="kai-conv">
          <div className="kai-conv-head">
            <span className="kai-conv-title">
              <Sparkles size={14} /> Dr. Kamaia
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
          <div
            className="kai-thread"
            ref={threadRef}
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
          <div className="kai-conv-foot">
            {inputForm}
            <div className="kai-conv-hint">
              O Dr. Kamaia pode cometer erros. Verifica informação crítica.
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
              para criar, abrir, actualizar. Eu trato do resto.
            </p>
          </div>

          {inputForm}

          <div className="kai-home-chips">
            {CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                className="kai-home-chip"
                onClick={() => void send(c.prompt)}
                disabled={sending}
              >
                <c.icon size={14} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <FirstRunBanner />
        </div>
      )}

      <style jsx>{`
        .kai-home {
          display: flex;
          align-items: center;
          justify-content: center;
          /* dvh: viewport dinâmico — em mobile exclui a barra de URL do
             browser, evitando que o input fixo fique atrás da chrome. */
          min-height: calc(100dvh - 120px);
          padding: 40px 24px;
        }
        /* Modo conversa: thread ocupa a página, input fixo em baixo. */
        .kai-home.threaded {
          align-items: stretch;
          justify-content: flex-start;
          padding: 0;
          min-height: 0;
          height: calc(100dvh - 116px);
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
      `}</style>
    </div>
  )
}

/**
 * Composer da homepage — componente PRÓPRIO com o seu styled-jsx.
 *
 * Crítico: o styled-jsx só aplica o scope a JSX que vive directamente
 * no return do componente onde está o <style jsx>. Quando o formulário
 * era extraído para uma `const inputForm` no componente da página, as
 * regras .kai-composer NUNCA casavam (o form ficava sem a classe de
 * scope) — daí a caixa aparecer sem estilo em todas as tentativas.
 * Isolando-o aqui, o <style jsx> e o JSX estão no mesmo componente e o
 * scope é garantido.
 *
 * Layout estilo Claude/ChatGPT: contentor largo em coluna, textarea
 * por cima a 100% de largura (multilinha + auto-grow, Enter envia /
 * Shift+Enter quebra linha), botão Enviar/Parar dentro em baixo à
 * direita.
 */
function HomeComposer({
  sending,
  onSend,
  onStop,
}: {
  sending: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  const submit = () => {
    const t = text.trim()
    if (!t || sending) return
    setText('')
    onSend(t)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="kai-composer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={ref}
        className="kai-composer-input"
        placeholder="Pergunta ao Dr. Kamaia…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={sending}
        rows={1}
        autoFocus
        aria-label="Pergunta ao Dr. Kamaia"
      />
      <div className="kai-composer-actions">
        {sending ? (
          <button
            type="button"
            className="kai-composer-btn stop"
            onClick={onStop}
            aria-label="Parar resposta"
            title="Parar"
          >
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            className="kai-composer-btn"
            disabled={!text.trim()}
            aria-label="Enviar"
            title="Enviar (Enter)"
          >
            <Send size={16} />
          </button>
        )}
      </div>

      <style jsx>{`
        .kai-composer {
          display: flex;
          flex-direction: column;
          width: 100%;
          box-sizing: border-box;
          gap: 6px;
          padding: 12px 14px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border-strong);
          border-radius: 16px;
          box-shadow: 0 4px 16px -10px rgba(0, 0, 0, 0.12);
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .kai-composer:focus-within {
          border-color: var(--k2-text);
          box-shadow: 0 6px 22px -10px rgba(0, 0, 0, 0.18);
        }
        .kai-composer-input {
          display: block;
          width: 100%;
          box-sizing: border-box;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: var(--k2-text);
          font-family: inherit;
          font-size: 15px;
          line-height: 1.5;
          padding: 4px 2px;
          min-height: 28px;
          max-height: 200px;
          overflow-y: auto;
        }
        .kai-composer-input::placeholder {
          color: var(--k2-text-mute);
        }
        .kai-composer-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }
        .kai-composer-btn {
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 120ms ease;
        }
        .kai-composer-btn:hover:not(:disabled) {
          opacity: 0.85;
        }
        .kai-composer-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .kai-composer-btn.stop {
          background: var(--k2-bg-elev-2);
          color: var(--k2-text);
          border: 1px solid var(--k2-border-strong);
        }
      `}</style>
    </form>
  )
}
