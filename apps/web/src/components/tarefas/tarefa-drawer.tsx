'use client'

/**
 * Drawer de criação/edição de tarefa.
 *
 * POST  /tarefas        (criar)
 * PATCH /tarefas/:id     (editar — inclui mudar estado)
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import {
  TarefaEstado,
  TarefaPrioridade,
  TAREFA_ESTADO_LABELS,
  TAREFA_PRIORIDADE_LABELS,
} from '@kamaia/shared-types'

export interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  estado: TarefaEstado
  prioridade: TarefaPrioridade
  dataVencimento: string | null
  colunaId: string | null
  responsavel: { id: string; firstName: string; lastName: string } | null
  contrato: { id: string; numeroInterno: string | null; titulo: string } | null
}

interface ChecklistItem {
  id: string
  texto: string
  concluido: boolean
  ordem: number
}
interface Comentario {
  id: string
  texto: string
  createdAt: string
  autor: { id: string; firstName: string; lastName: string } | null
}
interface TarefaDetalhe extends Tarefa {
  checklist: ChecklistItem[]
  comentarios: Comentario[]
}

export interface Membro {
  user: { id: string; firstName: string; lastName: string; email: string }
}

interface Props {
  open: boolean
  onClose: () => void
  tarefa?: Tarefa | null
  membros: Membro[]
  /** Pré-vincula a um contrato (ex.: aberto do detalhe do contrato). */
  contratoId?: string
  onSaved?: () => void
}

export function TarefaDrawer({ open, onClose, tarefa, membros, contratoId, onSaved }: Props) {
  const { data: session } = useSession()
  const editar = !!tarefa

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>(TarefaPrioridade.MEDIA)
  const [estado, setEstado] = useState<TarefaEstado>(TarefaEstado.A_FAZER)
  const [dataVencimento, setDataVencimento] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const token = session?.accessToken
  const meuId = session?.user?.id
  const [detalhe, setDetalhe] = useState<TarefaDetalhe | null>(null)
  const [novoItem, setNovoItem] = useState('')
  const [novoComentario, setNovoComentario] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Carrega o detalhe (checklist + comentários) ao editar.
  useEffect(() => {
    if (!open || !tarefa || !token) {
      setDetalhe(null)
      return
    }
    let cancelled = false
    api<TarefaDetalhe>(`/tarefas/${tarefa.id}`, { token })
      .then((d) => !cancelled && setDetalhe(d))
      .catch(() => !cancelled && setDetalhe(null))
    return () => {
      cancelled = true
    }
  }, [open, tarefa, token])

  useEffect(() => {
    if (open) setConfirmDelete(false)
  }, [open])

  // Cada acção de checklist/comentário devolve a tarefa detalhada actualizada.
  const acao = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      const d = await fn()
      setDetalhe(d as TarefaDetalhe)
    } catch {
      /* ignora — o estado actual mantém-se */
    } finally {
      setBusy(false)
    }
  }
  const addItem = () => {
    const texto = novoItem.trim()
    if (!texto || !tarefa || !token) return
    setNovoItem('')
    void acao(() =>
      api(`/tarefas/${tarefa.id}/checklist`, {
        method: 'POST',
        token,
        body: JSON.stringify({ texto }),
      }),
    )
  }
  const toggleItem = (it: ChecklistItem) => {
    if (!tarefa || !token) return
    void acao(() =>
      api(`/tarefas/${tarefa.id}/checklist/${it.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ concluido: !it.concluido }),
      }),
    )
  }
  const removeItem = (it: ChecklistItem) => {
    if (!tarefa || !token) return
    void acao(() =>
      api(`/tarefas/${tarefa.id}/checklist/${it.id}`, { method: 'DELETE', token }),
    )
  }
  const addComentario = () => {
    const texto = novoComentario.trim()
    if (!texto || !tarefa || !token) return
    setNovoComentario('')
    void acao(() =>
      api(`/tarefas/${tarefa.id}/comentarios`, {
        method: 'POST',
        token,
        body: JSON.stringify({ texto }),
      }),
    )
  }
  const removeComentario = (c: Comentario) => {
    if (!tarefa || !token) return
    void acao(() =>
      api(`/tarefas/${tarefa.id}/comentarios/${c.id}`, { method: 'DELETE', token }),
    )
  }
  const eliminar = async () => {
    if (!tarefa || !token) return
    setBusy(true)
    try {
      await api(`/tarefas/${tarefa.id}`, { method: 'DELETE', token })
      onSaved?.()
      onClose()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao eliminar a tarefa')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTitulo(tarefa?.titulo ?? '')
    setDescricao(tarefa?.descricao ?? '')
    setPrioridade(tarefa?.prioridade ?? TarefaPrioridade.MEDIA)
    setEstado(tarefa?.estado ?? TarefaEstado.A_FAZER)
    setDataVencimento(tarefa?.dataVencimento ? tarefa.dataVencimento.slice(0, 10) : '')
    setResponsavelId(tarefa?.responsavel?.id ?? '')
    setErr(null)
  }, [open, tarefa])

  const submit = async () => {
    if (!session?.accessToken) return
    if (titulo.trim().length < 1) {
      setErr('Dá um título à tarefa.')
      return
    }
    setSubmitting(true)
    setErr(null)
    const body: Record<string, unknown> = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || (editar ? null : undefined),
      prioridade,
      dataVencimento: dataVencimento || (editar ? null : undefined),
      responsavelId: responsavelId || (editar ? null : undefined),
      ...(editar ? { estado } : {}),
      ...(!editar && contratoId ? { contratoId } : {}),
    }
    try {
      if (editar) {
        await api(`/tarefas/${tarefa!.id}`, {
          method: 'PATCH',
          token: session.accessToken,
          body: JSON.stringify(body),
        })
      } else {
        await api('/tarefas', {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify(body),
        })
      }
      onSaved?.()
      onClose()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao guardar a tarefa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={560}>
      <DrawerHeader
        title={editar ? 'Editar tarefa' : 'Nova tarefa'}
        subtitle="Trabalho atribuível a um membro, com prazo e prioridade."
        onClose={onClose}
      />
      <DrawerBody>
        {err && <div className="tk-err">{err}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="tk-field">
            <span className="tk-label">Título *</span>
            <input className="tk-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} autoFocus placeholder="Ex.: Confirmar Imposto de Selo do CT-2026-0148" />
          </label>

          <label className="tk-field">
            <span className="tk-label">Descrição</span>
            <textarea className="tk-input" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={5000} style={{ resize: 'vertical' }} />
          </label>

          <div className="tk-grid">
            <label className="tk-field">
              <span className="tk-label">Prioridade</span>
              <select className="tk-input" value={prioridade} onChange={(e) => setPrioridade(e.target.value as TarefaPrioridade)}>
                {Object.values(TarefaPrioridade).map((p) => (
                  <option key={p} value={p}>{TAREFA_PRIORIDADE_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label className="tk-field">
              <span className="tk-label">Prazo</span>
              <input type="date" className="tk-input" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            </label>
          </div>

          <div className="tk-grid">
            <label className="tk-field">
              <span className="tk-label">Responsável</span>
              <select className="tk-input" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                <option value="">— Sem responsável —</option>
                {membros.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {`${m.user.firstName} ${m.user.lastName}`.trim() || m.user.email}
                  </option>
                ))}
              </select>
            </label>
            {editar && (
              <label className="tk-field">
                <span className="tk-label">Estado</span>
                <select className="tk-input" value={estado} onChange={(e) => setEstado(e.target.value as TarefaEstado)}>
                  {Object.values(TarefaEstado).map((s) => (
                    <option key={s} value={s}>{TAREFA_ESTADO_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {tarefa?.contrato && (
            <div className="tk-link">
              Vinculada ao contrato <strong>{tarefa.contrato.numeroInterno ?? tarefa.contrato.titulo}</strong>
            </div>
          )}

          {editar && detalhe && (
            <>
              <div className="tk-sec">
                <div className="tk-sec-head">
                  Checklist
                  {detalhe.checklist.length > 0 && (
                    <span className="tk-sec-count">
                      {detalhe.checklist.filter((i) => i.concluido).length}/{detalhe.checklist.length}
                    </span>
                  )}
                </div>
                <div className="tk-items">
                  {detalhe.checklist.map((it) => (
                    <div key={it.id} className="tk-item">
                      <input
                        type="checkbox"
                        checked={it.concluido}
                        onChange={() => toggleItem(it)}
                        disabled={busy}
                      />
                      <span className={it.concluido ? 'done' : ''}>{it.texto}</span>
                      <button className="tk-x" onClick={() => removeItem(it)} title="Remover" disabled={busy} type="button">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="tk-add">
                  <input
                    className="tk-input"
                    value={novoItem}
                    onChange={(e) => setNovoItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                    placeholder="Adicionar item…"
                    maxLength={500}
                  />
                  <Button variant="secondary" type="button" onClick={addItem} disabled={!novoItem.trim() || busy} leftIcon={<Plus size={13} />}>
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="tk-sec">
                <div className="tk-sec-head">Comentários</div>
                <div className="tk-coments">
                  {detalhe.comentarios.length === 0 && <div className="tk-vazio">Sem comentários ainda.</div>}
                  {detalhe.comentarios.map((c) => (
                    <div key={c.id} className="tk-coment">
                      <div className="tk-coment-top">
                        <span className="tk-autor">
                          {c.autor ? `${c.autor.firstName} ${c.autor.lastName}`.trim() : 'Alguém'}
                        </span>
                        <span className="tk-data">
                          {new Date(c.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {c.autor?.id === meuId && (
                          <button className="tk-x" onClick={() => removeComentario(c)} title="Apagar" disabled={busy} type="button">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="tk-coment-txt">{c.texto}</div>
                    </div>
                  ))}
                </div>
                <div className="tk-add">
                  <textarea
                    className="tk-input"
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                    rows={2}
                    placeholder="Escrever um comentário…"
                    maxLength={5000}
                    style={{ resize: 'vertical' }}
                  />
                  <Button variant="secondary" type="button" onClick={addComentario} disabled={!novoComentario.trim() || busy}>
                    Comentar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <style jsx>{`
          .tk-err { background: rgba(220,38,38,0.08); color: var(--k2-bad); padding: 10px 14px; border-radius: var(--k2-radius-sm); font-size: 12px; margin-bottom: 14px; }
          .tk-field { display: flex; flex-direction: column; gap: 6px; }
          .tk-label { font-size: 12px; font-weight: 500; color: var(--k2-text-dim); }
          .tk-input { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 9px 12px; font-size: 13px; font-family: inherit; color: var(--k2-text); outline: none; transition: border-color 120ms ease; }
          .tk-input:focus { border-color: var(--k2-accent); }
          .tk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .tk-link { font-size: 12px; color: var(--k2-text-mute); }

          .tk-sec { border-top: 1px solid var(--k2-border); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
          .tk-sec-head { font-size: 12px; font-weight: 600; color: var(--k2-text-dim); text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 8px; }
          .tk-sec-count { background: var(--k2-bg-elev-2); color: var(--k2-text-mute); border-radius: 10px; padding: 1px 8px; font-size: 11px; }
          .tk-items { display: flex; flex-direction: column; gap: 2px; }
          .tk-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--k2-text); padding: 3px 0; }
          .tk-item input { width: 15px; height: 15px; accent-color: var(--k2-accent); cursor: pointer; flex: 0 0 auto; }
          .tk-item span { flex: 1; }
          .tk-item span.done { text-decoration: line-through; color: var(--k2-text-mute); }
          .tk-x { background: none; border: 0; color: var(--k2-text-mute); cursor: pointer; padding: 2px; display: inline-flex; border-radius: 4px; flex: 0 0 auto; }
          .tk-x:hover { color: var(--k2-bad); background: var(--k2-bg-elev); }
          .tk-add { display: flex; gap: 8px; align-items: flex-start; }
          .tk-add .tk-input { flex: 1; }
          .tk-coments { display: flex; flex-direction: column; gap: 10px; }
          .tk-vazio { font-size: 12px; color: var(--k2-text-mute); }
          .tk-coment { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 8px 10px; }
          .tk-coment-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
          .tk-autor { font-size: 12px; font-weight: 600; color: var(--k2-text); }
          .tk-data { font-size: 11px; color: var(--k2-text-mute); }
          .tk-coment-top .tk-x { margin-left: auto; }
          .tk-coment-txt { font-size: 13px; color: var(--k2-text-dim); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
        `}</style>
      </DrawerBody>
      <DrawerFooter>
        {editar && (
          <Button
            variant="danger"
            type="button"
            loading={busy}
            leftIcon={<Trash2 size={14} />}
            onClick={() => {
              if (confirmDelete) void eliminar()
              else setConfirmDelete(true)
            }}
          >
            {confirmDelete ? 'Confirmar eliminação' : 'Eliminar'}
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="button" loading={submitting} onClick={() => void submit()}>
          {editar ? 'Guardar' : 'Criar tarefa'}
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
