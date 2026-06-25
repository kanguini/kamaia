'use client'

/**
 * KamaiaAIProvider — context partilhado pelo side panel persistente.
 *
 * Responsabilidades:
 *  - Manter visibilidade do side panel (open/close + atalho ⌘+J / Ctrl+J)
 *  - Manter referência ao `pageContext` actual (cada page declara via hook)
 *  - Gerir lifecycle de conversações: list, create, select, delete
 *  - Streaming SSE: chama POST /ia/conversations/:id/messages/stream
 *    com Bearer + X-Tenant-Id, parse e despacha eventos
 *  - Persistência das mensagens em memória; reload ao mudar de conversa
 *
 * Sprint 1.1 — sem tool use. Falamos só ao endpoint existente que faz
 * RAG sobre legislação angolana. Tool use entra em Sprint 1.2.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useSession } from 'next-auth/react'
import { api, apiUrl, getActiveTenantId } from '@/lib/api'
import type {
  Citation,
  Conversation,
  Message,
  PageContext,
  ToolCallTrace,
} from './types'

interface ConversationsResponse {
  data: Conversation[]
}

interface MessagesResponse {
  data: Message[]
}

interface KamaiaAIContextValue {
  // Visibilidade
  open: boolean
  toggle: () => void
  setOpen: (v: boolean) => void

  // Contexto de página
  pageContext: PageContext
  setPageContext: (ctx: PageContext) => void

  // Conversações
  conversations: Conversation[]
  conversationId: string | null
  selectConversation: (id: string) => void
  newConversation: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  reloadConversations: () => Promise<void>

  // Mensagens
  messages: Message[]
  send: (text: string) => Promise<void>
  sending: boolean
}

const KamaiaAIContext = createContext<KamaiaAIContextValue | null>(null)

export function useKamaiaAI(): KamaiaAIContextValue {
  const ctx = useContext(KamaiaAIContext)
  if (!ctx) {
    throw new Error(
      'useKamaiaAI() chamado fora de <KamaiaAIProvider>. ' +
        'O provider deve ser montado no DashboardLayout.',
    )
  }
  return ctx
}

/**
 * Hook que cada página usa para declarar o seu contexto.
 * Re-corre quando dependências mudam para que o backend receba sempre
 * o contexto actualizado no próximo turno.
 */
export function useKamaiaPageContext(ctx: PageContext): void {
  const setter = useContext(KamaiaAIContext)?.setPageContext
  // Stringify para evitar re-renders quando o objecto é estável mas
  // referencialmente novo a cada render.
  const key = JSON.stringify(ctx)
  useEffect(() => {
    if (!setter) return
    setter(ctx)
    // Limpa o contexto quando a page unmount (volta a 'other')
    return () => {
      setter({ type: 'other', pathname: '/' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setter])
}

interface ProviderProps {
  children: React.ReactNode
  /** Atalho de teclado para abrir/fechar. Default: ⌘+J / Ctrl+J */
  shortcutKey?: string
}

export function KamaiaAIProvider({ children, shortcutKey = 'j' }: ProviderProps) {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [pageContext, setPageContext] = useState<PageContext>({
    type: 'other',
    pathname: '/',
  })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)

  // Atalho global ⌘+J / Ctrl+J — funciona em qualquer página
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isShortcut =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcutKey
      if (isShortcut) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        // ESC só fecha se foco não está num input do panel — o próprio
        // panel decide isso. Aqui não interferimos.
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, shortcutKey])

  const toggle = useCallback(() => setOpen((v) => !v), [])

  // Carrega conversações
  const reloadConversations = useCallback(async () => {
    if (!session?.accessToken) return
    try {
      const res = await api<ConversationsResponse>('/ia/conversations', {
        token: session.accessToken,
      })
      setConversations(res.data ?? [])
    } catch {
      setConversations([])
    }
  }, [session?.accessToken])

  useEffect(() => {
    if (status === 'authenticated') void reloadConversations()
  }, [status, reloadConversations])

  // Carrega mensagens ao mudar de conversa
  useEffect(() => {
    if (!conversationId || !session?.accessToken) {
      setMessages([])
      return
    }
    api<MessagesResponse>(`/ia/conversations/${conversationId}/messages`, {
      token: session.accessToken,
    })
      .then((res) => setMessages(res.data ?? []))
      .catch(() => setMessages([]))
  }, [conversationId, session?.accessToken])

  const selectConversation = useCallback((id: string) => {
    setConversationId(id)
  }, [])

  const newConversation = useCallback(async () => {
    if (!session?.accessToken) return
    try {
      const conv = await api<Conversation>('/ia/conversations', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({}),
      })
      setConversations((prev) => [conv, ...prev])
      setConversationId(conv.id)
      setMessages([])
    } catch {
      // silently ignore — toast vem em sprint posterior
    }
  }, [session?.accessToken])

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!session?.accessToken) return
      try {
        await api(`/ia/conversations/${id}`, {
          method: 'DELETE',
          token: session.accessToken,
        })
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (conversationId === id) {
          setConversationId(null)
          setMessages([])
        }
      } catch {
        // ignore
      }
    },
    [session?.accessToken, conversationId],
  )

  /**
   * Envia mensagem via SSE streaming.
   *
   * 1. Se não há conversa activa, cria uma (lazy) e usa o id directamente.
   * 2. Insere placeholders optimisticos (user + assistant streaming).
   * 3. Abre fetch para /stream com Bearer + X-Tenant-Id.
   * 4. Parse SSE: user-msg, citations, text, done, error.
   * 5. Reconcilia ids reais; marca streaming=false em done.
   */
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || !session?.accessToken) return

      // Cria conversa on-demand se nenhuma estiver activa
      let activeId = conversationId
      if (!activeId) {
        try {
          const conv = await api<Conversation>('/ia/conversations', {
            method: 'POST',
            token: session.accessToken,
            body: JSON.stringify({}),
          })
          setConversations((prev) => [conv, ...prev])
          setConversationId(conv.id)
          activeId = conv.id
        } catch {
          return
        }
      }

      const tempUserId = `tmp-u-${Date.now()}`
      const tempAssistantId = `tmp-a-${Date.now()}`

      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
        {
          id: tempAssistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
          streaming: true,
        },
      ])
      setSending(true)

      try {
        const tenantId = getActiveTenantId()
        // Sprint 1.2: usa o endpoint agêntico /agent-stream que suporta
        // tool use. Backend faz round-trip multi-turn com Claude e
        // emite tool_use_start/tool_executing/tool_result além de text.
        const res = await fetch(
          apiUrl(`/ia/conversations/${activeId}/messages/agent-stream`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
              ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({
              conteudo: text,
              pageContext,
            }),
          },
        )

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const pendingCitations: Citation[] | undefined = undefined
        const toolCalls = new Map<string, ToolCallTrace>()

        const updateToolCalls = () => {
          const list = Array.from(toolCalls.values())
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId ? { ...m, toolCalls: list } : m,
            ),
          )
        }

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
            let data: { [key: string]: unknown }
            try {
              data = JSON.parse(dataLine.slice(6).trim())
            } catch {
              continue
            }

            if (kind === 'user-msg') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserId ? { ...m, id: String(data.messageId) } : m,
                ),
              )
            } else if (kind === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: m.content + String(data.delta) }
                    : m,
                ),
              )
            } else if (kind === 'tool_use_start') {
              toolCalls.set(String(data.id), {
                id: String(data.id),
                name: String(data.name),
                status: 'starting',
              })
              updateToolCalls()
            } else if (kind === 'tool_executing') {
              const entry = toolCalls.get(String(data.id))
              if (entry) {
                entry.status = 'executing'
                toolCalls.set(entry.id, entry)
                updateToolCalls()
              }
            } else if (kind === 'tool_result') {
              const entry = toolCalls.get(String(data.id)) ?? {
                id: String(data.id),
                name: String(data.name),
                status: 'done' as const,
              }
              entry.status = data.isError ? 'error' : 'done'
              const hint = data.renderHint as ToolCallTrace['renderHint']
              if (hint) entry.renderHint = hint
              if (data.uiPayload) {
                entry.uiPayload = data.uiPayload as ToolCallTrace['uiPayload']
              }
              if (data.isError && data.result) {
                const err = data.result as { message?: string }
                entry.errorMessage = err.message ?? 'Erro na tool'
              }
              toolCalls.set(entry.id, entry)
              updateToolCalls()
            } else if (kind === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...m,
                        id: String(data.assistantMessageId),
                        streaming: false,
                        citacoes: pendingCitations,
                      }
                    : m,
                ),
              )
              void reloadConversations()
            } else if (kind === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...m,
                        content: `⚠ ${String(data.message ?? 'Erro de IA')}`,
                        streaming: false,
                        errored: true,
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
                  errored: true,
                }
              : m,
          ),
        )
      } finally {
        setSending(false)
      }
    },
    [conversationId, pageContext, reloadConversations, session?.accessToken],
  )

  const value = useMemo<KamaiaAIContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      pageContext,
      setPageContext,
      conversations,
      conversationId,
      selectConversation,
      newConversation,
      deleteConversation,
      reloadConversations,
      messages,
      send,
      sending,
    }),
    [
      open,
      toggle,
      pageContext,
      conversations,
      conversationId,
      selectConversation,
      newConversation,
      deleteConversation,
      reloadConversations,
      messages,
      send,
      sending,
    ],
  )

  return (
    <KamaiaAIContext.Provider value={value}>{children}</KamaiaAIContext.Provider>
  )
}
