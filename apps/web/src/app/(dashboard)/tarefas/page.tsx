'use client'

/**
 * Gestor de tarefas — board por estado (A fazer / Em curso / Concluída),
 * com alternância Todas/Minhas, criar/editar em drawer e concluir rápido.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Plus, Check, CalendarClock, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { Button } from '@/components/ui/button'
import {
  TarefaEstado,
  TarefaPrioridade,
  TAREFA_PRIORIDADE_LABELS,
  type ItemTrabalho,
  TRABALHO_TIPO_LABELS,
} from '@kamaia/shared-types'
import { TarefaDrawer, type Tarefa, type Membro } from '@/components/tarefas/tarefa-drawer'

const COLUNAS: { estado: TarefaEstado; label: string }[] = [
  { estado: TarefaEstado.A_FAZER, label: 'A fazer' },
  { estado: TarefaEstado.EM_CURSO, label: 'Em curso' },
  { estado: TarefaEstado.CONCLUIDA, label: 'Concluída' },
]

const PRIO_COR: Record<TarefaPrioridade, string> = {
  URGENTE: 'var(--k2-bad)',
  ALTA: 'var(--k2-warn)',
  MEDIA: 'var(--k2-text-mute)',
  BAIXA: 'var(--k2-text-mute)',
}

export default function TarefasPage() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const token = session?.accessToken

  const [vista, setVista] = useState<'quadro' | 'trabalho'>('quadro')
  const [scope, setScope] = useState<'todas' | 'minhas'>('todas')
  const [trabalho, setTrabalho] = useState<ItemTrabalho[]>([])
  const [loadingTrab, setLoadingTrab] = useState(false)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editando, setEditando] = useState<Tarefa | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TarefaEstado | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const qs = new URLSearchParams({ incluirFechadas: 'true', limit: '200' })
    if (scope === 'minhas' && userId) qs.set('responsavelId', userId)
    try {
      const res = await api<unknown>(`/tarefas?${qs.toString()}`, { token })
      setTarefas(unwrapList<Tarefa>(res))
    } catch {
      setTarefas([])
    } finally {
      setLoading(false)
    }
  }, [token, scope, userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!token) return
    api<unknown>('/memberships', { token })
      .then((r) => setMembros(unwrapList<Membro>(r)))
      .catch(() => setMembros([]))
  }, [token])

  const loadTrabalho = useCallback(async () => {
    if (!token) return
    setLoadingTrab(true)
    try {
      const res = await api<{ itens: ItemTrabalho[] }>('/tarefas/trabalho?dias=90', { token })
      setTrabalho(res?.itens ?? [])
    } catch {
      setTrabalho([])
    } finally {
      setLoadingTrab(false)
    }
  }, [token])

  useEffect(() => {
    if (vista === 'trabalho') void loadTrabalho()
  }, [vista, loadTrabalho])

  const concluir = async (t: Tarefa) => {
    if (!token) return
    try {
      await api(`/tarefas/${t.id}/concluir`, { method: 'POST', token, body: JSON.stringify({}) })
      void load()
    } catch {
      /* erro silencioso; o refetch reflecte o estado real */
    }
  }

  // Drag-and-drop: muda o estado da tarefa ao largar noutra coluna.
  // Optimista (move já o cartão) + PATCH; refetch reconcilia carimbos
  // (ex.: concluidaEm) ou reverte em caso de erro.
  const mover = async (tarefaId: string, novoEstado: TarefaEstado) => {
    const t = tarefas.find((x) => x.id === tarefaId)
    if (!t || t.estado === novoEstado) return
    setTarefas((prev) =>
      prev.map((x) => (x.id === tarefaId ? { ...x, estado: novoEstado } : x)),
    )
    if (!token) return
    try {
      await api(`/tarefas/${tarefaId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ estado: novoEstado }),
      })
      void load()
    } catch {
      void load()
    }
  }

  const porColuna = useMemo(() => {
    const m: Record<string, Tarefa[]> = {}
    for (const c of COLUNAS) m[c.estado] = []
    for (const t of tarefas) if (m[t.estado]) m[t.estado].push(t)
    return m
  }, [tarefas])

  const abrirNova = () => {
    setEditando(null)
    setDrawerOpen(true)
  }
  const abrirEdicao = (t: Tarefa) => {
    setEditando(t)
    setDrawerOpen(true)
  }

  return (
    <div className="tz">
      <header className="tz-head">
        <div>
          <p className="tz-crumb">Trabalho</p>
          <h1 className="tz-h1">Tarefas</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tz-seg" role="tablist">
            <button className={vista === 'quadro' ? 'on' : ''} onClick={() => setVista('quadro')} role="tab" aria-selected={vista === 'quadro'}>Quadro</button>
            <button className={vista === 'trabalho' ? 'on' : ''} onClick={() => setVista('trabalho')} role="tab" aria-selected={vista === 'trabalho'}>O meu trabalho</button>
          </div>
          {vista === 'quadro' && (
            <div className="tz-seg" role="tablist">
              <button className={scope === 'todas' ? 'on' : ''} onClick={() => setScope('todas')} role="tab" aria-selected={scope === 'todas'}>Todas</button>
              <button className={scope === 'minhas' ? 'on' : ''} onClick={() => setScope('minhas')} role="tab" aria-selected={scope === 'minhas'}>Minhas</button>
            </div>
          )}
          <Button leftIcon={<Plus size={14} />} onClick={abrirNova}>Nova tarefa</Button>
        </div>
      </header>

      {vista === 'quadro' && (
        <div className="tz-board">
          {COLUNAS.map((c) => (
            <div
              key={c.estado}
              className={`tz-col${dragOver === c.estado ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOver !== c.estado) setDragOver(c.estado)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || draggingId
                setDragOver(null)
                if (id) void mover(id, c.estado)
              }}
            >
              <div className="tz-col-head">
                <span>{c.label}</span>
                <span className="tz-count">{porColuna[c.estado]?.length ?? 0}</span>
              </div>
              <div className="tz-col-body">
                {loading && <div className="tz-empty">A carregar…</div>}
                {!loading && (porColuna[c.estado]?.length ?? 0) === 0 && (
                  <div className="tz-empty">Arraste para aqui ou crie uma tarefa.</div>
                )}
                {porColuna[c.estado]?.map((t) => (
                  <TarefaCard
                    key={t.id}
                    tarefa={t}
                    dragging={draggingId === t.id}
                    onClick={() => abrirEdicao(t)}
                    onConcluir={() => void concluir(t)}
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDragOver(null)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'trabalho' && <TrabalhoLista itens={trabalho} loading={loadingTrab} />}

      <TarefaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tarefa={editando}
        membros={membros}
        onSaved={() => void load()}
      />

      <style jsx>{`
        .tz { display: flex; flex-direction: column; gap: 18px; }
        .tz-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .tz-crumb { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--k2-accent); margin: 0 0 4px; }
        .tz-h1 { font-size: 24px; font-weight: 500; margin: 0; }
        .tz-seg { display: inline-flex; border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); overflow: hidden; }
        .tz-seg button { background: var(--k2-bg-elev); border: 0; padding: 8px 14px; font-size: 13px; color: var(--k2-text-dim); cursor: pointer; font-family: inherit; }
        .tz-seg button.on { background: var(--k2-accent); color: var(--k2-accent-fg); }
        .tz-board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
        @media (max-width: 900px) { .tz-board { grid-template-columns: 1fr; } }
        .tz-col { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 12px; transition: border-color 120ms ease, background 120ms ease; }
        .tz-col.over { border-color: var(--k2-accent); background: var(--k2-bg-hover, var(--k2-bg-elev-2)); }
        .tz-col-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 600; color: var(--k2-text-dim); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px; }
        .tz-count { background: var(--k2-bg-elev-2); color: var(--k2-text-mute); border-radius: 10px; padding: 1px 8px; font-size: 11px; }
        .tz-col-body { display: flex; flex-direction: column; gap: 8px; min-height: 40px; }
        .tz-empty { font-size: 12px; color: var(--k2-text-mute); text-align: center; padding: 14px 0; }
      `}</style>
    </div>
  )
}

const TRAB_COR: Record<ItemTrabalho['tipo'], string> = {
  tarefa: '#15803d',
  obrigacao: '#7c3aed',
  compliance: '#b45309',
  'data-chave': '#0e7490',
}

function TrabalhoLista({ itens, loading }: { itens: ItemTrabalho[]; loading: boolean }) {
  if (loading) return <div className="tw-empty">A carregar…</div>
  if (itens.length === 0) return <div className="tw-empty">Sem trabalho pendente.</div>
  const agora = Date.now()
  return (
    <div className="tw">
      {itens.map((i) => {
        const venc = i.prazo ? new Date(i.prazo) : null
        const atrasada = !!venc && venc.getTime() < agora
        return (
          <Link key={i.id} href={i.href} className="tw-row">
            <span className="tw-bar" style={{ background: TRAB_COR[i.tipo] }} aria-hidden />
            <div className="tw-main">
              <div className="tw-title">{i.titulo}</div>
              <div className="tw-meta">
                <span className="tw-tag" style={{ color: TRAB_COR[i.tipo] }}>{TRABALHO_TIPO_LABELS[i.tipo]}</span>
                {i.contratoNumero && <span className="tw-ct">{i.contratoNumero}</span>}
                {venc ? (
                  <span className={atrasada ? 'tw-venc bad' : 'tw-venc'}>
                    {venc.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                  </span>
                ) : (
                  <span className="tw-venc">sem prazo</span>
                )}
              </div>
            </div>
            {atrasada && <span className="tw-atraso">Em atraso</span>}
          </Link>
        )
      })}
      <style jsx>{`
        .tw { display: flex; flex-direction: column; gap: 4px; }
        .tw-empty { font-size: 13px; color: var(--k2-text-mute); text-align: center; padding: 32px 0; }
        .tw-row { display: flex; align-items: center; gap: 12px; padding: 11px 12px; background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); text-decoration: none; }
        .tw-row:hover { border-color: var(--k2-accent); }
        .tw-bar { width: 3px; align-self: stretch; border-radius: 3px; flex: 0 0 auto; }
        .tw-main { min-width: 0; flex: 1; }
        .tw-title { font-size: 13.5px; color: var(--k2-text); line-height: 1.4; }
        .tw-meta { display: flex; align-items: center; gap: 8px; margin-top: 3px; font-size: 11.5px; color: var(--k2-text-mute); flex-wrap: wrap; }
        .tw-tag { font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; font-size: 10.5px; }
        .tw-ct { font-family: var(--font-mono, monospace); color: var(--k2-accent); }
        .tw-venc.bad { color: var(--k2-bad); font-weight: 500; }
        .tw-atraso { flex: 0 0 auto; font-size: 10.5px; font-weight: 600; color: var(--k2-bad); background: rgba(220,38,38,0.1); border-radius: 6px; padding: 3px 8px; }
      `}</style>
    </div>
  )
}

function TarefaCard({
  tarefa,
  dragging,
  onClick,
  onConcluir,
  onDragStart,
  onDragEnd,
}: {
  tarefa: Tarefa
  dragging?: boolean
  onClick: () => void
  onConcluir: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
}) {
  const fechada = tarefa.estado === TarefaEstado.CONCLUIDA || tarefa.estado === TarefaEstado.CANCELADA
  const venc = tarefa.dataVencimento ? new Date(tarefa.dataVencimento) : null
  const atrasada = !!venc && !fechada && venc.getTime() < Date.now()
  const resp = tarefa.responsavel
  const iniciais = resp ? `${resp.firstName[0] ?? ''}${resp.lastName[0] ?? ''}`.toUpperCase() : null

  return (
    <div
      className={`tc${dragging ? ' dragging' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', tarefa.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragEnd={() => onDragEnd?.()}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <div className="tc-top">
        <span className="tc-prio" style={{ color: PRIO_COR[tarefa.prioridade] }}>
          {TAREFA_PRIORIDADE_LABELS[tarefa.prioridade]}
        </span>
        {!fechada && (
          <button className="tc-done" title="Concluir" onClick={(e) => { e.stopPropagation(); onConcluir() }}>
            <Check size={13} />
          </button>
        )}
      </div>
      <div className="tc-title" style={{ textDecoration: fechada ? 'line-through' : 'none', opacity: fechada ? 0.65 : 1 }}>
        {tarefa.titulo}
      </div>
      <div className="tc-meta">
        {venc && (
          <span className={atrasada ? 'tc-venc bad' : 'tc-venc'}>
            {atrasada ? <AlertTriangle size={11} /> : <CalendarClock size={11} />}
            {venc.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {tarefa.contrato && (
          <Link href={`/contratos/${tarefa.contrato.id}`} className="tc-ct" onClick={(e) => e.stopPropagation()}>
            {tarefa.contrato.numeroInterno ?? 'contrato'}
          </Link>
        )}
        {iniciais && <span className="tc-resp" title={`${resp!.firstName} ${resp!.lastName}`}>{iniciais}</span>}
      </div>
      <style jsx>{`
        .tc { background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 10px 12px; cursor: grab; transition: border-color 120ms ease, opacity 120ms ease; }
        .tc:hover { border-color: var(--k2-border-strong, var(--k2-accent)); }
        .tc:active { cursor: grabbing; }
        .tc.dragging { opacity: 0.5; }
        .tc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .tc-prio { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        .tc-done { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--k2-border); background: var(--k2-bg-elev); color: var(--k2-text-mute); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .tc-done:hover { color: var(--k2-ok, #2faa6a); border-color: var(--k2-ok, #2faa6a); }
        .tc-title { font-size: 13px; color: var(--k2-text); line-height: 1.4; }
        .tc-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
        .tc-venc { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--k2-text-mute); }
        .tc-venc.bad { color: var(--k2-bad); }
        .tc-ct { font-size: 11px; color: var(--k2-accent); text-decoration: none; font-family: var(--font-mono, monospace); }
        .tc-resp { margin-left: auto; width: 22px; height: 22px; border-radius: 50%; background: var(--k2-bg-elev-2); color: var(--k2-text-dim); font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
      `}</style>
    </div>
  )
}
