'use client'

/**
 * Painel de comentários da contraparte (e internos).
 *
 * Usado dentro do Editor — mostra os comentários ancorados em cláusulas
 * (autor USER ou COLABORADOR), permite ao owner responder, resolver,
 * e ver de relance o que está aberto. A versão activa filtra os
 * comentários (cada comentário fica associado a uma `versaoId` se a
 * caller passar).
 *
 * Decisão UX: separamos por estado — "Abertos" no topo, "Resolvidos"
 * recolhidos. Click para expandir thread (parent + replies, embora o
 * MVP só suporte parent-only ainda).
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { CheckCircle2, Circle, MessageSquarePlus, Send, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Comentario {
  id: string
  versaoId: string | null
  clausulaRef: string
  texto: string
  autorTipo: 'USER' | 'COLABORADOR'
  autorNome: string | null
  autorUserId: string | null
  autorColaboradorId: string | null
  resolvido: boolean
  resolvidoPor: string | null
  resolvidoEm: string | null
  createdAt: string
  parentComentarioId: string | null
}

export function ComentariosPanel({
  contratoId,
  versaoId,
}: {
  contratoId: string
  versaoId: string | null
}) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<Comentario[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolvidos, setShowResolvidos] = useState(false)
  const [novoTexto, setNovoTexto] = useState('')
  const [novoCl, setNovoCl] = useState('Geral')
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = async () => {
    if (status !== 'authenticated' || !session?.accessToken) return
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('includeResolved', 'true')
      if (versaoId) qs.set('versaoId', versaoId)
      const data = await api<Comentario[]>(
        `/contratos/${contratoId}/comentarios?${qs.toString()}`,
        { token: session.accessToken },
      )
      setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, versaoId, session?.accessToken, status])

  const submitNovo = async () => {
    if (!novoTexto.trim() || !session?.accessToken) return
    setSubmitting(true)
    try {
      await api(`/contratos/${contratoId}/comentarios`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          texto: novoTexto.trim(),
          clausulaRef: novoCl.trim() || 'Geral',
          versaoId: versaoId ?? undefined,
        }),
      })
      setNovoTexto('')
      void fetchAll()
    } finally {
      setSubmitting(false)
    }
  }

  const onResolver = async (id: string) => {
    if (!session?.accessToken) return
    try {
      await api(`/contratos/${contratoId}/comentarios/${id}/resolver`, {
        method: 'PATCH',
        token: session.accessToken,
      })
      void fetchAll()
    } catch (e) {
      alert((e as { error?: string })?.error ?? 'Erro ao resolver')
    }
  }

  const abertos = items.filter((c) => !c.resolvido)
  const resolvidos = items.filter((c) => c.resolvido)

  return (
    <section
      style={{
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MessageSquarePlus size={16} />
        <div style={{ fontSize: 14, fontWeight: 500 }}>Comentários da negociação</div>
        <Badge variant={abertos.length > 0 ? 'warning' : 'default'}>
          {abertos.length} aberto{abertos.length === 1 ? '' : 's'}
        </Badge>
        {resolvidos.length > 0 && (
          <button
            onClick={() => setShowResolvidos((v) => !v)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid var(--k2-border)',
              color: 'var(--k2-text-dim)',
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 'var(--k2-radius-sm)',
              cursor: 'pointer',
            }}
          >
            {showResolvidos ? 'Ocultar' : 'Mostrar'} {resolvidos.length} resolvido{resolvidos.length === 1 ? '' : 's'}
          </button>
        )}
      </header>

      {loading ? (
        <div style={{ color: 'var(--k2-text-mute)', fontSize: 13 }}>A carregar…</div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--k2-text-mute)', fontSize: 12, padding: '8px 0' }}>
          Sem comentários ainda. Os colaboradores externos podem comentar pelo link partilhado, e tu podes deixar notas internas aqui.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {abertos.map((c) => (
            <ComentarioCard key={c.id} c={c} onResolver={onResolver} />
          ))}
          {showResolvidos && resolvidos.map((c) => (
            <ComentarioCard key={c.id} c={c} onResolver={onResolver} />
          ))}
        </ul>
      )}

      <div
        style={{
          borderTop: '1px solid var(--k2-border)',
          paddingTop: 12,
          display: 'grid',
          gridTemplateColumns: '180px 1fr auto',
          gap: 8,
          alignItems: 'start',
        }}
      >
        <Input
          value={novoCl}
          onChange={(e) => setNovoCl(e.target.value)}
          placeholder="Cláusula (ex.: 3.2)"
        />
        <textarea
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          placeholder="Nota interna ou resposta à contraparte…"
          rows={2}
          style={{
            background: 'var(--k2-bg)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            padding: '8px 10px',
            color: 'var(--k2-text)',
            fontSize: 13,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <Button
          onClick={submitNovo}
          disabled={!novoTexto.trim()}
          loading={submitting}
          leftIcon={<Send size={12} />}
        >
          Comentar
        </Button>
      </div>
    </section>
  )
}

function ComentarioCard({
  c,
  onResolver,
}: {
  c: Comentario
  onResolver: (id: string) => void
}) {
  return (
    <li
      style={{
        background: 'var(--k2-bg)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius-sm)',
        padding: '10px 12px',
        opacity: c.resolvido ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {c.resolvido ? (
          <CheckCircle2 size={14} color="var(--k2-good, #16a34a)" />
        ) : (
          <Circle size={14} color="var(--k2-text-mute)" />
        )}
        <span style={{ fontSize: 12, fontWeight: 500 }}>{c.autorNome ?? 'Anónimo'}</span>
        <Badge variant={c.autorTipo === 'COLABORADOR' ? 'info' : 'default'}>
          {c.autorTipo === 'COLABORADOR' ? 'Externo' : 'Interno'}
        </Badge>
        <Badge variant="default">{c.clausulaRef}</Badge>
        <span style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginLeft: 'auto' }}>
          {new Date(c.createdAt).toLocaleString('pt-PT')}
        </span>
      </div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--k2-text)' }}>
        {c.texto}
      </div>
      {!c.resolvido && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onResolver(c.id)}
            style={{
              background: 'transparent',
              border: '1px solid var(--k2-border)',
              color: 'var(--k2-text-dim)',
              padding: '3px 8px',
              borderRadius: 'var(--k2-radius-sm)',
              cursor: 'pointer',
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={11} /> Marcar como resolvido
          </button>
        </div>
      )}
    </li>
  )
}
