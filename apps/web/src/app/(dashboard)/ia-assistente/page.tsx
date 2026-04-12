'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, Send, Trash2, Bot, AlertCircle, Sparkles, Loader2 } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSession } from 'next-auth/react'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  title: string
  context: 'GERAL' | 'PROCESSO' | 'PRAZO'
  contextId: string | null
  createdAt: string
  updatedAt: string
  messages?: Message[]
}

interface QuotaInfo {
  used: number
  limit: number | null
  remaining: number | null
}

const SUGGESTIONS = [
  'Qual o prazo para contestar uma accao civel?',
  'O meu cliente foi despedido. Que opcoes tem?',
  'Quais os requisitos para criar uma sociedade?',
  'Analise os riscos deste contrato',
]

const CONTEXT_LABELS = {
  PROCESSO: { label: 'Processo', color: 'text-ink bg-surface-raised border border-border' },
  PRAZO: { label: 'Prazo', color: 'text-danger bg-danger/10 border-danger/20' },
  GERAL: { label: 'Geral', color: 'text-info bg-info/10 border-info/20' },
}

function renderContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n(\d+)\. /g, '</p><p>$1. ')
    .replace(/\n- /g, '</p><p>- ')
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `ha ${minutes} min`
  if (hours < 24) return `ha ${hours}h`
  if (days === 1) return 'ontem'
  if (days < 7) return `ha ${days} dias`
  return date.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit' })
}

function ConversationSkeleton() {
  return (
    <div className="p-3 space-y-2 animate-pulse">
      <div className="h-4 bg-surface-raised rounded w-3/4" />
      <div className="h-3 bg-surface-raised rounded w-1/2" />
    </div>
  )
}

function MessageSkeleton() {
  return (
    <div className="flex gap-3 items-start animate-pulse">
      <div className="w-8 h-8 rounded-full bg-surface-raised flex-shrink-0" />
      <div className="flex-1 bg-surface-raised p-4 space-y-2">
        <div className="h-4 bg-border rounded w-3/4" />
        <div className="h-4 bg-border rounded w-1/2" />
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-ink" />
      </div>
      <div className="bg-surface-raised  p-4">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

function IAAssistenteContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const processoId = searchParams.get('processoId')
  const context = searchParams.get('context') as 'PROCESSO' | 'PRAZO' | null

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: conversations, loading: loadingConversations, refetch: refetchConversations } =
    useApi<Conversation[]>('/ia/conversations')
  const { data: quota } = useApi<QuotaInfo>('/ia/quota')
  const { data: activeConversation, loading: loadingMessages, refetch: refetchMessages } =
    useApi<Conversation>(activeConversationId ? `/ia/conversations/${activeConversationId}` : null)

  const { mutate: createConversation } = useMutation<
    { context?: string; contextId?: string },
    Conversation
  >('/ia/conversations', 'POST')
  const { mutate: sendMessage } = useMutation<{ content: string }, Message>(
    activeConversationId ? `/ia/conversations/${activeConversationId}/messages` : '/ia/conversations',
    'POST',
  )
  const deleteConversationFn = async (id: string) => {
    if (!session?.accessToken) return null
    try {
      await api(`/ia/conversations/${id}`, { method: 'DELETE', token: session.accessToken })
      return true
    } catch { return null }
  }

  // Auto-create conversation from URL params
  useEffect(() => {
    if (processoId && context && !activeConversationId) {
      handleCreateConversation(context, processoId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId, context])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputMessage])

  const handleCreateConversation = async (ctx?: string, ctxId?: string) => {
    const result = await createConversation({
      context: ctx || 'GERAL',
      contextId: ctxId,
    })
    if (result) {
      setActiveConversationId(result.id)
      refetchConversations()
      setMobileMenuOpen(false)
    }
  }

  const handleSendMessage = async (content?: string) => {
    const messageContent = content || inputMessage.trim()
    if (!messageContent) return

    // If no active conversation, create one first
    if (!activeConversationId) {
      const conv = await createConversation({ context: 'GERAL' })
      if (!conv) return
      setActiveConversationId(conv.id)
      refetchConversations()
    }

    setSending(true)
    setInputMessage('')

    const result = await sendMessage({ content: messageContent })
    if (result) {
      refetchMessages()
      refetchConversations()
      if (quota) {
        // Refetch quota to update count
        window.location.reload() // Simple way to refresh quota
      }
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('Tem certeza que deseja eliminar esta conversa?')) return
    const result = await deleteConversationFn(id)
    if (result !== null) {
      if (activeConversationId === id) {
        setActiveConversationId(null)
      }
      refetchConversations()
    }
  }

  const handleSuggestionClick = async (suggestion: string) => {
    if (!activeConversationId) {
      const conv = await createConversation({ context: 'GERAL' })
      if (!conv) return
      setActiveConversationId(conv.id)
      refetchConversations()
    }
    handleSendMessage(suggestion)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const quotaExhausted = quota && quota.limit && quota.remaining !== null && quota.remaining <= 0
  const isPro = quota && quota.limit === null

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6 max-w-7xl mx-auto">
      {/* Left panel - Conversations list */}
      <div
        className={cn(
          'w-[280px] bg-ink  flex flex-col overflow-hidden flex-shrink-0',
          'lg:flex',
          mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden',
        )}
      >
        <div className="p-4 border-b border-bone/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-2xl font-semibold text-ink">Kamaia IA</h2>
            <button
              onClick={() => handleCreateConversation()}
              className="p-2 hover:bg-ink/10  transition-colors text-ink"
              title="Nova conversa"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <ConversationSkeleton key={i} />
              ))}
            </div>
          ) : conversations && conversations.length > 0 ? (
            <div className="space-y-1 p-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id)
                    setMobileMenuOpen(false)
                  }}
                  className={cn(
                    'group p-3  cursor-pointer transition-colors relative',
                    activeConversationId === conv.id
                      ? 'bg-white/10 text-paper'
                      : 'text-white/80 hover:bg-white/5',
                  )}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <p className="font-medium text-sm flex-1 truncate">
                      {conv.title || 'Nova conversa'}
                    </p>
                    {conv.context !== 'GERAL' && (
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded border flex-shrink-0',
                          CONTEXT_LABELS[conv.context].color,
                        )}
                      >
                        {CONTEXT_LABELS[conv.context].label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/60">
                      {getRelativeTime(new Date(conv.updatedAt))}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteConversation(conv.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-danger/20 rounded transition-all text-danger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-white/60 text-sm">Nenhuma conversa</div>
          )}
        </div>

        <div className="p-4 border-t border-bone/10">
          <div className="text-xs text-white/60 font-mono">
            {isPro ? (
              <span className="text-success">Consultas ilimitadas</span>
            ) : quota ? (
              <span>
                {quota.used}/{quota.limit} consultas usadas
              </span>
            ) : (
              <span>Carregando...</span>
            )}
          </div>
        </div>
      </div>

      {/* Right panel - Chat area */}
      <div className="flex-1 bg-surface  flex flex-col overflow-hidden">
        {!activeConversationId ? (
          /* Welcome screen */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center">
              <div className="mb-6">
                <Sparkles className="w-16 h-16 text-ink mx-auto mb-4" />
                <h1 className="font-display text-4xl font-semibold text-ink mb-2">
                  Kamaia IA
                </h1>
                <p className="text-ink-muted text-lg">Assistente Juridico Inteligente</p>
              </div>
              <p className="text-ink mb-8">
                Faca uma pergunta sobre legislacao angolana, prazos processuais, ou analise de
                documentos.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="p-4 bg-surface border border-border text-left hover:bg-surface-raised/80 transition-colors group"
                  >
                    <p className="text-ink text-sm group-hover:text-ink transition-colors">
                      {suggestion}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 hover:bg-surface border border-border transition-colors"
                >
                  <Bot className="w-5 h-5 text-ink" />
                </button>
                <div>
                  <h2 className="font-medium text-ink">
                    {activeConversation?.title || 'Nova conversa'}
                  </h2>
                  {activeConversation?.context !== 'GERAL' && (
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border inline-block',
                        CONTEXT_LABELS[activeConversation?.context || 'GERAL'].color,
                      )}
                    >
                      {CONTEXT_LABELS[activeConversation?.context || 'GERAL'].label}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-ink-muted font-mono">
                {quota && quota.remaining !== null && (
                  <span>{quota.remaining} consultas restantes</span>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border-b border-amber px-4 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-ink-700 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-ink-700">
                Modo demonstracao — respostas simuladas. Nao use para decisoes legais.
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingMessages ? (
                <MessageSkeleton />
              ) : activeConversation?.messages && activeConversation.messages.length > 0 ? (
                activeConversation.messages.map((message) => {
                  const isUser = message.role === 'USER'
                  return (
                    <div key={message.id} className="flex gap-3 items-start">
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-ink" />
                        </div>
                      )}
                      <div
                        className={cn(
                          ' p-4 max-w-3xl',
                          isUser
                            ? 'bg-surface-raised ml-auto'
                            : 'bg-surface-raised',
                        )}
                      >
                        <div
                          className="text-ink prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: `<p>${renderContent(message.content)}</p>`,
                          }}
                        />
                        <p className="text-xs text-ink-muted mt-2">
                          {new Date(message.createdAt).toLocaleTimeString('pt-AO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center flex-shrink-0 text-ink font-mono text-xs">
                          U
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="text-center text-ink-muted py-8">Inicie a conversa</div>
              )}

              {sending && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border bg-white p-4">
              {quotaExhausted ? (
                <div className="bg-danger/10 border border-danger/20  p-4 text-center">
                  <p className="text-danger text-sm mb-2">Limite de consultas atingido</p>
                  <Link
                    href="/configuracoes"
                    className="text-ink text-sm font-medium hover:underline"
                  >
                    Upgrade para Pro
                  </Link>
                </div>
              ) : (
                <div className="flex gap-3">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Faca uma pergunta juridica..."
                    rows={1}
                    disabled={sending}
                    className="flex-1 px-4 py-3 bg-surface-raised border border-border  focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent resize-none disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || sending}
                    className={cn(
                      'w-12 h-12 rounded-full bg-white text-[#070707] flex items-center justify-center',
                      'hover:bg-white/90 transition-colors flex-shrink-0',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function IAAssistentePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-pulse text-ink-muted">A carregar...</div></div>}>
      <IAAssistenteContent />
    </Suspense>
  )
}
