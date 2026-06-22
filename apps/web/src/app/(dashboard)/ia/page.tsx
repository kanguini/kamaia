'use client'

/**
 * Kamaia CLM — IA chat.
 *
 * Stub-aware: respostas são placeholders por enquanto. UI mostra aviso.
 */

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Send } from 'lucide-react'
import { fmtDateTime } from '@/lib/clm-format'

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
  const { mutate: sendMsg, loading: sending } = useMutation<{ content: string }, { userMessage: Message; assistantMessage: Message }>(
    activeId ? `/ia/conversations/${activeId}/messages` : '/ia/conversations/_/messages',
    'POST',
  )

  const handleNew = async () => {
    const conv = await createConv({})
    if (conv) {
      setConversations((prev) => [conv, ...prev])
      setActiveId(conv.id)
      setMessages([])
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !activeId) return
    const content = input.trim()
    setInput('')
    // optimistic user message
    const tempId = `tmp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', content, createdAt: new Date().toISOString() },
    ])
    const result = await sendMsg({ content })
    if (result) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        result.userMessage,
        result.assistantMessage,
      ])
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
          As respostas da IA são <strong>placeholders</strong> nesta fase — a integração com o motor de extracção e Q&A está em desenvolvimento.
        </div>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!activeId && <div style={{ color: 'var(--k2-text-mute)' }}>Cria uma conversa para começar.</div>}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: 12,
                background: m.role === 'user' ? 'var(--k2-accent)' : 'var(--k2-bg-elev-2)',
                color: m.role === 'user' ? 'var(--k2-accent-fg)' : 'var(--k2-text)',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}
        </div>
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
