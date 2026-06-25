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
  useRef,
  useState,
} from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pageContext, setPageContext] = useState<PageContext>({
    type: 'other',
    pathname: '/',
  })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)

  // Atalho global ⌘+J / Ctrl+J — funciona em qualquer página.
  //
  // Onda B.UI.12: NÃO captura quando:
  //   - utilizador está em composição IME (acentos, kanji, etc.)
  //   - foco está num input/textarea/contenteditable
  //     (deixa o browser/extensions usarem Ctrl+J como costumam)
  //   - O próprio botão ✨ do topbar já permite toggle por click —
  //     o atalho é "extra", não único caminho.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const target = e.target as HTMLElement | null
      const editable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      // Toggle vindo do próprio panel é OK (utilizador pode fechar
      // com ⌘+J mesmo enquanto escreve)
      const fromPanel = !!target?.closest('[data-kamaia-ai-panel]')
      const isShortcut =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcutKey
      if (isShortcut && (!editable || fromPanel)) {
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

  // Carrega mensagens ao mudar de conversa.
  //
  // Onda B.UI.13: depende APENAS de `conversationId`. Antes incluía
  // `session?.accessToken` na dep array — quando NextAuth rotava o
  // JWT mid-stream, este effect re-corria e fazia setMessages com
  // o estado do servidor, **apagando** o placeholder do assistente
  // a meio do streaming. Solução: ler token via ref dentro do
  // effect, sem o ter como dependência.
  const tokenRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    tokenRef.current = session?.accessToken
  }, [session?.accessToken])

  useEffect(() => {
    const token = tokenRef.current
    if (!conversationId || !token) {
      setMessages([])
      return
    }
    let cancelled = false
    api<MessagesResponse>(`/ia/conversations/${conversationId}/messages`, {
      token,
    })
      .then((res) => {
        if (!cancelled) setMessages(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  const selectConversation = useCallback((id: string) => {
    setConversationId(id)
  }, [])

  // Onda B.UI.10: AbortController do stream em vôo. Single source
  // partilhado: se nova send começa antes da anterior terminar, ou
  // se a conversa muda, abortamos a anterior.
  const sendAbortRef = useRef<AbortController | null>(null)

  // Cancela ao desmontar o provider OU ao mudar de conversa
  useEffect(() => {
    return () => {
      sendAbortRef.current?.abort()
    }
  }, [conversationId])

  // Onda A.5: shared in-flight ref para criação de conversação.
  // Sem isto, click "+" + send rápido criavam 2 conversações em
  // paralelo (a 1ª ficava órfã no servidor). Agora ambos caminhos
  // partilham a mesma promise se houver criação em curso.
  const creatingConvRef = useRef<Promise<Conversation> | null>(null)

  const createConversationShared = useCallback(
    async (token: string): Promise<Conversation | null> => {
      if (creatingConvRef.current) {
        return creatingConvRef.current
      }
      const p = api<Conversation>('/ia/conversations', {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      })
        .then((conv) => {
          // Push para o início da lista e set como activa.
          // Note: race-safe porque apenas 1 promise existe a qualquer
          // momento — qualquer chamada subsequente espera por esta.
          setConversations((prev) => [conv, ...prev])
          return conv
        })
        .finally(() => {
          creatingConvRef.current = null
        })
      creatingConvRef.current = p
      try {
        return await p
      } catch {
        return null
      }
    },
    [],
  )

  const newConversation = useCallback(async () => {
    if (!session?.accessToken) return
    const conv = await createConversationShared(session.accessToken)
    if (conv) {
      setConversationId(conv.id)
      setMessages([])
    }
  }, [session?.accessToken, createConversationShared])

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

      // Cria conversa on-demand se nenhuma estiver activa. Usa o
      // shared in-flight ref (Onda A.5) para coordenar com
      // newConversation() — se utilizador clicar + escrever rápido,
      // apenas 1 POST é feito ao servidor.
      let activeId = conversationId
      if (!activeId) {
        const conv = await createConversationShared(session.accessToken)
        if (!conv) return
        setConversationId(conv.id)
        activeId = conv.id
      }

      // Onda A.4: usar randomUUID em vez de Date.now() para evitar
      // colisão quando 2 sends ocorrem no mesmo milissegundo (e.g.
      // click num chip + Enter rápido). crypto.randomUUID() é
      // suportado em todos os browsers modernos (>=Chrome 92, FF 95,
      // Safari 15.4) e Node 19+. Fallback para timestamp+rand caso
      // execute num runtime sem crypto.randomUUID (SSR antigo).
      const newId = (prefix: string): string => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return `${prefix}${crypto.randomUUID()}`
        }
        return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      }
      const tempUserId = newId('tmp-u-')
      const tempAssistantId = newId('tmp-a-')

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

      // Onda B.UI.10: AbortController. Cancela request em vôo se o
      // utilizador inicia outra send, fecha o panel, ou muda de
      // conversa. Sem isto, o reader continua a consumir bytes e
      // chama setMessages em estado irrelevante.
      sendAbortRef.current?.abort()
      const ac = new AbortController()
      sendAbortRef.current = ac

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
            signal: ac.signal,
          },
        )

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        // Onda C.2.4: citations não fazem parte do endpoint
        // /agent-stream — são exclusivas do legacy RAG /stream
        // (Q&A com legislação). Aqui ficam sempre undefined.
        // Quando integrarmos RAG dentro do agente, adicionamos
        // handler para 'citations' SSE event aqui.
        const pendingCitations: Citation[] | undefined = undefined
        const toolCalls = new Map<string, ToolCallTrace>()

        // Onda B.UI.11: garantir que só a 1ª `navigate` per stream
        // dispara router.push. Streams com múltiplos open_contrato
        // (raro mas possível) deixariam o utilizador navegado para
        // o segundo, perdendo controlo.
        let hasNavigated = false

        const updateToolCalls = () => {
          // Onda B.UI.9: clone profundo dos entries para não mutar
          // o estado que React já capturou em snapshots anteriores
          // (concurrent rendering tearing).
          const list = Array.from(toolCalls.values()).map((t) => ({ ...t }))
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
                // Clone em vez de mutar — B.UI.9
                toolCalls.set(entry.id, { ...entry, status: 'executing' })
                updateToolCalls()
              }
            } else if (kind === 'tool_result') {
              const existing = toolCalls.get(String(data.id))
              const hint = data.renderHint as ToolCallTrace['renderHint']
              const next: ToolCallTrace = {
                id: existing?.id ?? String(data.id),
                name: existing?.name ?? String(data.name),
                status: data.isError ? 'error' : 'done',
                renderHint: hint ?? existing?.renderHint,
                uiPayload: data.uiPayload
                  ? (data.uiPayload as ToolCallTrace['uiPayload'])
                  : existing?.uiPayload,
                errorMessage:
                  data.isError && data.result
                    ? (data.result as { message?: string }).message ?? 'Erro na tool'
                    : existing?.errorMessage,
              }
              toolCalls.set(next.id, next)
              updateToolCalls()

              // Auto-navigate: apenas a 1ª por stream (B.UI.11)
              if (
                !hasNavigated &&
                !data.isError &&
                hint === 'navigate' &&
                data.result &&
                typeof data.result === 'object' &&
                'target' in (data.result as object)
              ) {
                const target = (data.result as { target: unknown }).target
                if (typeof target === 'string' && target.startsWith('/')) {
                  hasNavigated = true
                  router.push(target)
                }
              }
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
        // Onda B.UI.10: AbortError não é falha do utilizador — foi
        // cancelamento intencional (mudou de conversa, fechou panel,
        // disparou outra send). Não mostra erro na bolha.
        const isAbort =
          e instanceof Error &&
          (e.name === 'AbortError' || e.message.includes('aborted'))
        if (!isAbort) {
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
        }
      } finally {
        // Só limpar sendAbortRef se ainda apontar para o nosso ac —
        // se outro send já o substituiu, não tocar.
        if (sendAbortRef.current === ac) sendAbortRef.current = null
        setSending(false)
      }
    },
    [
      conversationId,
      createConversationShared,
      pageContext,
      reloadConversations,
      router,
      session?.accessToken,
    ],
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
