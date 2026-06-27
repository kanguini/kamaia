'use client'

/**
 * Modal de criação/edição de evento de agenda. Eventos derivados de
 * contratos (datas-chave, actos, obrigações) não são editáveis aqui —
 * só eventos próprios chegam a este modal.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import {
  AgendaEventoTipo,
  AGENDA_EVENTO_TIPO_LABELS,
} from '@kamaia/shared-types'
import { toYmd, toHm, fromYmdHm, type AgendaItem } from './agenda-utils'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Data pré-seleccionada (ao clicar num dia). */
  dataInicial?: Date
  /** Evento a editar (quando vem de clicar num evento próprio). */
  editar?: AgendaItem
}

export function EventoModal({ open, onClose, onSaved, dataInicial, editar }: Props) {
  const { data: session } = useSession()
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<AgendaEventoTipo>(AgendaEventoTipo.GERAL)
  const [data, setData] = useState('')
  const [diaInteiro, setDiaInteiro] = useState(false)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('10:00')
  const [local, setLocal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Hidrata o form ao abrir.
  useEffect(() => {
    if (!open) return
    setErro(null)
    if (editar) {
      const ini = new Date(editar.inicio)
      setTitulo(editar.titulo)
      setTipo((editar.tipo as AgendaEventoTipo) ?? AgendaEventoTipo.GERAL)
      setData(toYmd(ini))
      setDiaInteiro(editar.diaInteiro)
      setHoraInicio(toHm(ini))
      setHoraFim(editar.fim ? toHm(new Date(editar.fim)) : toHm(ini))
      setLocal('')
      setDescricao('')
    } else {
      const base = dataInicial ?? new Date()
      setTitulo('')
      setTipo(AgendaEventoTipo.GERAL)
      setData(toYmd(base))
      setDiaInteiro(false)
      setHoraInicio('09:00')
      setHoraFim('10:00')
      setLocal('')
      setDescricao('')
    }
  }, [open, editar, dataInicial])

  const token = session?.accessToken

  const submit = async () => {
    if (!titulo.trim() || !data || !token) return
    setSaving(true)
    setErro(null)
    try {
      const inicio = diaInteiro
        ? fromYmdHm(data, '00:00')
        : fromYmdHm(data, horaInicio)
      const fim = diaInteiro ? undefined : fromYmdHm(data, horaFim)
      const body = {
        titulo: titulo.trim(),
        tipo,
        inicio: inicio.toISOString(),
        ...(fim && { fim: fim.toISOString() }),
        diaInteiro,
        ...(local.trim() && { local: local.trim() }),
        ...(descricao.trim() && { descricao: descricao.trim() }),
      }
      if (editar) {
        await api(`/agenda/${editar.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        })
      } else {
        await api('/agenda', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        })
      }
      onSaved()
      onClose()
    } catch {
      setErro('Não foi possível guardar o evento. Verifica os dados.')
    } finally {
      setSaving(false)
    }
  }

  const remover = async () => {
    if (!editar || !token) return
    setSaving(true)
    try {
      await api(`/agenda/${editar.id}`, { method: 'DELETE', token })
      onSaved()
      onClose()
    } catch {
      setErro('Não foi possível eliminar o evento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editar ? 'Editar evento' : 'Novo evento'}
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Campo label="Título">
          <input
            className="ag-inp"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Reunião com a contraparte"
            autoFocus
          />
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Tipo">
            <select
              className="ag-inp"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as AgendaEventoTipo)}
            >
              {Object.values(AgendaEventoTipo).map((t) => (
                <option key={t} value={t}>
                  {AGENDA_EVENTO_TIPO_LABELS[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Data">
            <input
              className="ag-inp"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={diaInteiro}
            onChange={(e) => setDiaInteiro(e.target.checked)}
          />
          Dia inteiro
        </label>

        {!diaInteiro && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Hora de início">
              <input
                className="ag-inp"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </Campo>
            <Campo label="Hora de fim">
              <input
                className="ag-inp"
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </Campo>
          </div>
        )}

        <Campo label="Local (opcional)">
          <input
            className="ag-inp"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex: Escritório, Luanda"
          />
        </Campo>

        <Campo label="Notas (opcional)">
          <textarea
            className="ag-inp"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </Campo>

        {erro && (
          <div style={{ fontSize: 12, color: 'var(--k2-bad)' }}>{erro}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          {editar ? (
            <Button variant="ghost" onClick={() => void remover()} disabled={saving}>
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={saving || !titulo.trim()}
            >
              {saving ? 'A guardar…' : editar ? 'Guardar' : 'Criar evento'}
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ag-inp {
          width: 100%;
          padding: 9px 11px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          font-size: 13px;
          font-family: inherit;
          outline: none;
        }
        .ag-inp:focus {
          border-color: var(--k2-text);
        }
      `}</style>
    </Modal>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}
