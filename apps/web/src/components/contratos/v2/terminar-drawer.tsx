'use client'

/**
 * Drawer de terminação — acção de um contrato EM VIGOR (ou em disputa).
 *
 * Regista a terminação: tipo (natureza jurídica), data efectiva e
 * motivação. O backend transita o contrato para EM_TERMINACAO →
 * TERMINADO e cria o registo de terminação com obrigações pós-termo.
 *
 * POST /contratos/:id/terminacao { tipo, dataEfectiva, motivacao? }
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { TerminacaoTipo } from '@kamaia/shared-types'

interface Props {
  open: boolean
  onClose: () => void
  contratoId: string
  onSaved?: () => void
}

const TIPO_LABELS: Record<TerminacaoTipo, string> = {
  [TerminacaoTipo.NATURAL]: 'Natural (fim do prazo)',
  [TerminacaoTipo.DENUNCIA_TEMPESTIVA]: 'Denúncia tempestiva',
  [TerminacaoTipo.RESOLUCAO_INCUMPRIMENTO]: 'Resolução por incumprimento',
  [TerminacaoTipo.REVOGACAO_MUTUA]: 'Revogação por mútuo acordo',
  [TerminacaoTipo.FORCA_MAIOR]: 'Força maior',
  [TerminacaoTipo.CADUCIDADE]: 'Caducidade',
  [TerminacaoTipo.OUTRO]: 'Outro',
}

export function TerminarDrawer({ open, onClose, contratoId, onSaved }: Props) {
  const { data: session } = useSession()
  const [tipo, setTipo] = useState<TerminacaoTipo>(TerminacaoTipo.NATURAL)
  const [dataEfectiva, setDataEfectiva] = useState('')
  const [motivacao, setMotivacao] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTipo(TerminacaoTipo.NATURAL)
    setDataEfectiva(new Date().toISOString().slice(0, 10))
    setMotivacao('')
    setErr(null)
  }, [open])

  const submit = async () => {
    if (!session?.accessToken) return
    if (!dataEfectiva) {
      setErr('Indica a data efectiva da terminação.')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      await api(`/contratos/${contratoId}/terminacao`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          tipo,
          dataEfectiva,
          motivacao: motivacao.trim() || undefined,
        }),
      })
      onSaved?.()
      onClose()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao registar a terminação')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={580}>
      <DrawerHeader
        title="Terminar contrato"
        subtitle="Regista a terminação. O contrato passa a terminado e fica em leitura."
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
          <label className="tm-field">
            <span className="tm-label">Natureza da terminação *</span>
            <select
              className="tm-input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TerminacaoTipo)}
            >
              {Object.values(TerminacaoTipo).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="tm-field">
            <span className="tm-label">Data efectiva *</span>
            <input
              type="date"
              className="tm-input"
              value={dataEfectiva}
              onChange={(e) => setDataEfectiva(e.target.value)}
              style={{ width: 180 }}
            />
          </label>

          <label className="tm-field">
            <span className="tm-label">Motivação</span>
            <textarea
              className="tm-input"
              value={motivacao}
              onChange={(e) => setMotivacao(e.target.value)}
              placeholder="Fundamento da terminação (opcional, mas recomendado para o registo)."
              rows={4}
              maxLength={5000}
              style={{ resize: 'vertical' }}
            />
          </label>
        </div>

        <style jsx>{`
          .tm-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .tm-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--k2-text-dim);
          }
          .tm-input {
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
          .tm-input:focus {
            border-color: var(--k2-accent);
          }
        `}</style>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" loading={submitting} onClick={() => void submit()}>
          Registar terminação
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
