'use client'

/**
 * Drawer de criação/edição de tarefa.
 *
 * POST  /tarefas        (criar)
 * PATCH /tarefas/:id     (editar — inclui mudar estado)
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
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
  responsavel: { id: string; firstName: string; lastName: string } | null
  contrato: { id: string; numeroInterno: string | null; titulo: string } | null
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
        </div>

        <style jsx>{`
          .tk-err { background: rgba(220,38,38,0.08); color: var(--k2-bad); padding: 10px 14px; border-radius: var(--k2-radius-sm); font-size: 12px; margin-bottom: 14px; }
          .tk-field { display: flex; flex-direction: column; gap: 6px; }
          .tk-label { font-size: 12px; font-weight: 500; color: var(--k2-text-dim); }
          .tk-input { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 9px 12px; font-size: 13px; font-family: inherit; color: var(--k2-text); outline: none; transition: border-color 120ms ease; }
          .tk-input:focus { border-color: var(--k2-accent); }
          .tk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .tk-link { font-size: 12px; color: var(--k2-text-mute); }
        `}</style>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="button" loading={submitting} onClick={() => void submit()}>
          {editar ? 'Guardar' : 'Criar tarefa'}
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
