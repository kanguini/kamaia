'use client'

/**
 * Kamaia CLM — IA chat.
 *
 * Stub-aware: respostas são placeholders por enquanto. UI mostra aviso.
 */

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, apiUrl, getActiveTenantId } from '@/lib/api'
import { useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Send, BookOpen } from 'lucide-react'
import { fmtDateTime } from '@/lib/clm-format'

interface Citation {
  documentCodigo: string
  titulo: string
  artigo: string | null
  trecho: string
}

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** Estado UI: streaming (resposta a chegar), settled (gravada) */
  streaming?: boolean
  citacoes?: Citation[]
}

interface ConversationsResponse {
  data: Conversation[]
}

interface MessagesResponse {
  data: Message[]
}

export default function IAPage() {
  const { data: session, status } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Load conversations
  const loadConversations = async () => {
    if (!session?.accessToken) return
    const res = await api<ConversationsResponse>('/ia/conversations', { token: session.accessToken })
    setConversations(res.data ?? [])
    if (!activeId && res.data && res.data.length > 0) setActiveId(res.data[0].id)
  }

  useEffect(() => {
    if (status === 'authenticated') loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.accessToken])

  // Load messages on activeId change
  useEffect(() => {
    if (!activeId || !session?.accessToken) {
      setMessages([])
      return
    }
    api<MessagesResponse>(`/ia/conversations/${activeId}/messages`, { token: session.accessToken })
      .then((res) => setMessages(res.data ?? []))
      .catch(() => setMessages([]))
  }, [activeId, session?.accessToken])

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const { mutate: createConv } = useMutation<{ title?: string }, Conversation>('/ia/conversations', 'POST')
  const [sending, setSending] = useState(false)

  const handleNew = async () => {
    const conv = await createConv({})
    if (conv) {
      setConversations((prev) => [conv, ...prev])
      setActiveId(conv.id)
      setMessages([])
    }
  }

  /**
   * Envia mensagem via SSE streaming. Faz fetch para /stream endpoint
   * com headers Bearer + X-Tenant-Id (EventSource não suporta headers,
   * por isso usamos fetch + ReadableStream parser).
   *
   * Eventos consumidos:
   *  - user-msg: confirma id real da mensagem do utilizador
   *  - citations: array de chunks RAG; anexa ao próximo assistant
   *  - text: delta de texto; concatena na bolha streaming
   *  - done: marca streaming=false, atribui id real
   *  - error: substitui placeholder com mensagem de erro
   */
  const handleSend = async () => {
    if (!input.trim() || !activeId || !session?.accessToken) return
    const content = input.trim()
    setInput('')
    setSending(true)

    const tempUserId = `tmp-u-${Date.now()}`
    const tempAssistantId = `tmp-a-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: 'user', content, createdAt: new Date().toISOString() },
      { id: tempAssistantId, role: 'assistant', content: '', createdAt: new Date().toISOString(), streaming: true },
    ])

    try {
      const tenantId = getActiveTenantId()
      const res = await fetch(
        apiUrl(`/ia/conversations/${activeId}/messages/stream`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
            ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ content }),
        },
      )
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let pendingCitations: Citation[] | undefined

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''

        for (const block of blocks) {
          const lines = block.split('\n')
          const eventLine = lines.find((l) => l.startsWith('event: '))
          const dataLine = lines.find((l) => l.startsWith('data: '))
          if (!eventLine || !dataLine) continue
          const kind = eventLine.slice(7).trim()
          const data = JSON.parse(dataLine.slice(6).trim())

          if (kind === 'user-msg') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempUserId ? { ...m, id: data.messageId } : m,
              ),
            )
          } else if (kind === 'citations') {
            pendingCitations = data.citacoes as Citation[]
          } else if (kind === 'text') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: m.content + (data.delta as string) }
                  : m,
              ),
            )
          } else if (kind === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      id: data.assistantMessageId,
                      streaming: false,
                      citacoes: pendingCitations,
                    }
                  : m,
              ),
            )
          } else if (kind === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      content: `⚠ ${data.message}`,
                      streaming: false,
                    }
                  : m,
              ),
            )
            break
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId
            ? {
                ...m,
                content: `⚠ Erro de ligação: ${(e as Error).message}`,
                streaming: false,
              }
            : m,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 20, minHeight: 'calc(100vh - 160px)' }}>
      {/* Sidebar */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button leftIcon={<Plus size={14} />} onClick={handleNew}>Nova conversa</Button>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {conversations.length === 0 && (
            <div style={{ color: 'var(--k2-text-mute)', fontSize: 12, padding: 8 }}>Sem conversas.</div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                background: c.id === activeId ? 'var(--k2-bg-elev-2)' : 'var(--k2-bg-elev)',
                border: '1px solid var(--k2-border)',
                borderRadius: 'var(--k2-radius-sm)',
                color: 'var(--k2-text)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title || 'Sem título'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{fmtDateTime(c.updatedAt)}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <section style={{ display: 'flex', flexDirection: 'column', background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--k2-border)', fontSize: 11, color: 'var(--k2-text-mute)' }}>
          Respostas em tempo-real via streaming. Citações à legislação aparecem por baixo de cada resposta.
        </div>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!activeId && <div style={{ color: 'var(--k2-text-mute)' }}>Cria uma conversa para começar.</div>}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 6,
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: m.role === 'user' ? 'var(--k2-accent)' : 'var(--k2-bg-elev-2)',
                  color: m.role === 'user' ? 'var(--k2-accent-fg)' : 'var(--k2-text)',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  position: 'relative',
                }}
              >
                {m.content || (m.streaming && '…')}
                {m.streaming && m.content && (
                  <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--k2-text-dim)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 800ms infinite' }} />
                )}
              </div>
              {m.role === 'assistant' && m.citacoes && m.citacoes.length > 0 && (
                <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <BookOpen size={10} /> Citações
                  </div>
                  {m.citacoes.map((c, i) => (
                    <div key={i} style={{ background: 'var(--k2-bg)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)', padding: '6px 10px', fontSize: 11 }}>
                      <div style={{ fontWeight: 500, color: 'var(--k2-text)' }}>
                        {c.documentCodigo}{c.artigo ? ` art. ${c.artigo}` : ''}
                      </div>
                      <div style={{ color: 'var(--k2-text-mute)', marginTop: 2 }}>{c.titulo}</div>
                      <div style={{ color: 'var(--k2-text-dim)', marginTop: 4, fontStyle: 'italic' }}>
                        &ldquo;{c.trecho.slice(0, 180)}…&rdquo;
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <style jsx>{`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}</style>
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--k2-border)' }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={activeId ? 'Escreve uma pergunta…' : 'Cria uma conversa para começar.'}
            disabled={!activeId || sending}
          />
          <Button onClick={handleSend} disabled={!activeId || !input.trim()} loading={sending} rightIcon={<Send size={14} />}>
            Enviar
          </Button>
        </div>
      </section>
    </div>
  )
}
