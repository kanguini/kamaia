'use client'

/**
 * Drawer de criação de adenda — a acção primária de um contrato EM VIGOR.
 *
 * Uma adenda é um sub-ciclo derivado do contrato-pai: herda partes e
 * termos por defeito, e ao ser criada o pai entra em EM_ADENDA até a
 * adenda ser concluída. Aqui só recolhemos o essencial; o resto (corpo,
 * assinatura) segue o ciclo de vida normal da adenda.
 *
 * POST /contratos/:id/adendas  → { titulo, descricao?, herdarPartes, dataTermo? }
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  contratoId: string
  /** Título do contrato-pai, para sugerir um título de adenda. */
  contratoTitulo?: string
  onSaved?: () => void
}

export function AdendaDrawer({ open, onClose, contratoId, contratoTitulo, onSaved }: Props) {
  const { data: session } = useSession()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [herdarPartes, setHerdarPartes] = useState(true)
  const [dataTermo, setDataTermo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitulo(contratoTitulo ? `Adenda — ${contratoTitulo}` : '')
    setDescricao('')
    setHerdarPartes(true)
    setDataTermo('')
    setErr(null)
  }, [open, contratoTitulo])

  const submit = async () => {
    if (!session?.accessToken) return
    if (titulo.trim().length < 2) {
      setErr('Dá um título à adenda.')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      await api(`/contratos/${contratoId}/adendas`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          herdarPartes,
          dataTermo: dataTermo || undefined,
        }),
      })
      onSaved?.()
      onClose()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao criar a adenda')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={600}>
      <DrawerHeader
        title="Adicionar adenda"
        subtitle="Cria um aditamento ao contrato. Herda partes e termos do contrato-pai."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div
            style={{
              background: 'rgba(220,38,38,0.08)',
              color: 'var(--k2-bad)',
              padding: '10px 14px',
              borderRadius: 'var(--k2-radius-sm)',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            {err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="ad-field">
            <span className="ad-label">Título da adenda *</span>
            <input
              className="ad-input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Adenda — revisão de preço 2026"
              maxLength={300}
              autoFocus
            />
          </label>

          <label className="ad-field">
            <span className="ad-label">Objecto da adenda</span>
            <textarea
              className="ad-input"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que esta adenda altera ou acrescenta ao contrato."
              rows={4}
              maxLength={5000}
              style={{ resize: 'vertical' }}
            />
          </label>

          <label className="ad-check">
            <input
              type="checkbox"
              checked={herdarPartes}
              onChange={(e) => setHerdarPartes(e.target.checked)}
            />
            <span>
              Herdar as partes do contrato-pai
              <small>As mesmas contrapartes, nos mesmos papéis. Podes ajustar depois.</small>
            </span>
          </label>

          <label className="ad-field">
            <span className="ad-label">Nova data de termo (opcional)</span>
            <input
              type="date"
              className="ad-input"
              value={dataTermo}
              onChange={(e) => setDataTermo(e.target.value)}
              style={{ width: 180 }}
            />
            <small className="ad-hint">
              Deixa vazio para manter a data de termo do contrato-pai.
            </small>
          </label>
        </div>

        <style jsx>{`
          .ad-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .ad-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--k2-text-dim);
          }
          .ad-input {
            background: var(--k2-bg-elev);
            border: 1px solid var(--k2-border);
            border-radius: var(--k2-radius-sm);
            padding: 9px 12px;
            font-size: 13px;
            font-family: inherit;
            color: var(--k2-text);
            outline: none;
            transition: border-color 120ms ease;
          }
          .ad-input:focus {
            border-color: var(--k2-accent);
          }
          .ad-hint {
            font-size: 11px;
            color: var(--k2-text-mute);
          }
          .ad-check {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 13px;
            color: var(--k2-text);
            cursor: pointer;
          }
          .ad-check input {
            margin-top: 2px;
          }
          .ad-check small {
            display: block;
            font-size: 11px;
            color: var(--k2-text-mute);
            margin-top: 2px;
          }
        `}</style>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" loading={submitting} onClick={() => void submit()}>
          Criar adenda
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
