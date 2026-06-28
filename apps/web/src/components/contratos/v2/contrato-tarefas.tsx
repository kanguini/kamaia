'use client'

/**
 * Secção de tarefas no detalhe do contrato — o trabalho humano ligado
 * a este contrato, a par dos sinais derivados. Auto-contido: busca as
 * suas tarefas e os membros, e reutiliza o TarefaDrawer.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import {
  TarefaEstado,
  TAREFA_ESTADO_LABELS,
  TAREFA_PRIORIDADE_LABELS,
} from '@kamaia/shared-types'
import { TarefaDrawer, type Tarefa, type Membro } from '@/components/tarefas/tarefa-drawer'

export function ContratoTarefas({ contratoId }: { contratoId: string }) {
  const { data: session } = useSession()
  const token = session?.accessToken
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [loaded, setLoaded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editando, setEditando] = useState<Tarefa | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await api<unknown>(
        `/tarefas?contratoId=${contratoId}&incluirFechadas=true&limit=100`,
        { token },
      )
      setTarefas(unwrapList<Tarefa>(res))
    } catch {
      setTarefas([])
    } finally {
      setLoaded(true)
    }
  }, [token, contratoId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!token) return
    api<unknown>('/memberships', { token })
      .then((r) => setMembros(unwrapList<Membro>(r)))
      .catch(() => setMembros([]))
  }, [token])

  const concluir = async (t: Tarefa) => {
    if (!token) return
    try {
      await api(`/tarefas/${t.id}/concluir`, { method: 'POST', token, body: JSON.stringify({}) })
      void load()
    } catch {
      /* refetch reflecte o estado real */
    }
  }

  const abertas = tarefas.filter(
    (t) => t.estado !== TarefaEstado.CONCLUIDA && t.estado !== TarefaEstado.CANCELADA,
  )
  const fechadas = tarefas.filter(
    (t) => t.estado === TarefaEstado.CONCLUIDA || t.estado === TarefaEstado.CANCELADA,
  )

  return (
    <div className="ctk">
      <div className="ctk-head">
        <h3>
          Tarefas
          {abertas.length > 0 && <span className="ctk-count">{abertas.length}</span>}
        </h3>
        <button type="button" className="ctk-add" onClick={() => { setEditando(null); setDrawerOpen(true) }}>
          <Plus size={13} /> Nova
        </button>
      </div>

      {loaded && tarefas.length === 0 && (
        <div className="ctk-empty">Sem tarefas neste contrato.</div>
      )}

      <div className="ctk-list">
        {[...abertas, ...fechadas].map((t) => {
          const fechada = t.estado === TarefaEstado.CONCLUIDA || t.estado === TarefaEstado.CANCELADA
          const venc = t.dataVencimento ? new Date(t.dataVencimento) : null
          const atrasada = !!venc && !fechada && venc.getTime() < Date.now()
          return (
            <div key={t.id} className="ctk-row" onClick={() => { setEditando(t); setDrawerOpen(true) }}>
              {!fechada ? (
                <button type="button" className="ctk-check" title="Concluir" onClick={(e) => { e.stopPropagation(); void concluir(t) }}>
                  <Check size={12} />
                </button>
              ) : (
                <span className="ctk-check done"><Check size={12} /></span>
              )}
              <div className="ctk-main">
                <div className="ctk-title" style={{ textDecoration: fechada ? 'line-through' : 'none', opacity: fechada ? 0.6 : 1 }}>
                  {t.titulo}
                </div>
                <div className="ctk-meta">
                  <span>{TAREFA_PRIORIDADE_LABELS[t.prioridade]}</span>
                  {venc && <span className={atrasada ? 'bad' : ''}>· {venc.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>}
                  {t.responsavel && <span>· {t.responsavel.firstName}</span>}
                  {fechada && <span>· {TAREFA_ESTADO_LABELS[t.estado]}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <TarefaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tarefa={editando}
        membros={membros}
        contratoId={contratoId}
        onSaved={() => void load()}
      />

      <style jsx>{`
        .ctk { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 14px 16px; }
        .ctk-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .ctk-head h3 { font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--k2-text-dim); margin: 0; display: flex; align-items: center; gap: 8px; }
        .ctk-count { background: var(--k2-bg-elev-2); color: var(--k2-text-mute); border-radius: 9px; padding: 0 7px; font-size: 10.5px; }
        .ctk-add { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--k2-text-dim); background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 5px 10px; cursor: pointer; font-family: inherit; }
        .ctk-add:hover { color: var(--k2-text); border-color: var(--k2-accent); }
        .ctk-empty { font-size: 12px; color: var(--k2-text-mute); padding: 8px 0; }
        .ctk-list { display: flex; flex-direction: column; gap: 2px; }
        .ctk-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 6px; border-radius: var(--k2-radius-sm); cursor: pointer; }
        .ctk-row:hover { background: var(--k2-bg-hover, var(--k2-bg)); }
        .ctk-check { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 6px; border: 1px solid var(--k2-border); background: var(--k2-bg); color: var(--k2-text-mute); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; }
        .ctk-check:hover { color: var(--k2-ok, #2faa6a); border-color: var(--k2-ok, #2faa6a); }
        .ctk-check.done { background: var(--k2-ok, #2faa6a); color: #fff; border-color: var(--k2-ok, #2faa6a); cursor: default; }
        .ctk-main { min-width: 0; }
        .ctk-title { font-size: 13px; color: var(--k2-text); line-height: 1.4; }
        .ctk-meta { display: flex; gap: 5px; flex-wrap: wrap; font-size: 11px; color: var(--k2-text-mute); margin-top: 2px; }
        .ctk-meta .bad { color: var(--k2-bad); }
      `}</style>
    </div>
  )
}
