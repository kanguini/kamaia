'use client'

/**
 * Drawer de edição dos Termos & Vigência do contrato.
 *
 * Sprint 3.4: usa <InlineSentenceField> para forms inline em prosa.
 * Em vez de 6 campos atómicos para renovação/denúncia, lê-se como
 * frase:
 *
 *   "Renova automaticamente em ciclos de [12] [meses ▼]."
 *   "Notifica [60] [dias antes] do termo para denunciar."
 *
 * Foco em edição rápida dos campos que mais afectam alertas:
 *   - Data de termo
 *   - Renovação automática + prazo
 *   - Janela de denúncia
 *
 * O resto dos campos do contrato (título, descrição, etc.) edita-se
 * no <novo-contrato-flow> ou via Kamaia AI.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import {
  InlineSentenceField,
  InlineFieldsStyles,
} from './inline-fields'

interface Props {
  open: boolean
  onClose: () => void
  contratoId: string
  initial: {
    dataTermo: string | null
    renovacaoAutomatica: boolean
    prazoRenovacaoMeses: number | null
    janelaDenunciaDias: number | null
  }
  onSaved?: () => void
}

const UNIDADES_RENOV = [
  { value: 'meses', label: 'meses' },
  { value: 'anos', label: 'anos' },
]

export function TermosDrawer({ open, onClose, contratoId, initial, onSaved }: Props) {
  const { data: session } = useSession()
  const [dataTermo, setDataTermo] = useState<string | ''>('')
  const [renovacao, setRenovacao] = useState(false)
  const [renovQty, setRenovQty] = useState<number | ''>('')
  const [renovUnidade, setRenovUnidade] = useState<'meses' | 'anos'>('meses')
  const [denunciaDias, setDenunciaDias] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDataTermo(initial.dataTermo ?? '')
    setRenovacao(initial.renovacaoAutomatica)
    if (initial.prazoRenovacaoMeses && initial.prazoRenovacaoMeses >= 12 && initial.prazoRenovacaoMeses % 12 === 0) {
      setRenovQty(initial.prazoRenovacaoMeses / 12)
      setRenovUnidade('anos')
    } else if (initial.prazoRenovacaoMeses) {
      setRenovQty(initial.prazoRenovacaoMeses)
      setRenovUnidade('meses')
    } else {
      setRenovQty('')
      setRenovUnidade('meses')
    }
    setDenunciaDias(initial.janelaDenunciaDias ?? '')
    setErr(null)
  }, [open, initial])

  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true)
    setErr(null)
    try {
      const meses =
        renovQty === '' ? null : renovUnidade === 'anos' ? renovQty * 12 : renovQty
      await api(`/contratos/${contratoId}`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({
          dataTermo: dataTermo || null,
          renovacaoAutomatica: renovacao,
          prazoRenovacaoMeses: renovacao ? meses : null,
          janelaDenunciaDias: denunciaDias === '' ? null : denunciaDias,
        }),
      })
      onSaved?.()
      onClose()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao gravar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={600}>
      <DrawerHeader
        title="Termos & vigência"
        subtitle="Edita as datas que influenciam alertas e renovação."
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
            }}
          >
            {err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Termo */}
          <InlineSentenceField
            fragments={[
              'O contrato',
              {
                type: 'toggle',
                checked: !!dataTermo,
                onLabel: 'tem termo',
                offLabel: 'é por tempo indeterminado',
                onChange: (v) => setDataTermo(v ? new Date().toISOString().slice(0, 10) : ''),
              },
              ...(dataTermo
                ? [
                    'em',
                    {
                      type: 'custom' as const,
                      render: () => (
                        <input
                          type="date"
                          className="isf-input"
                          value={dataTermo}
                          onChange={(e) => setDataTermo(e.target.value)}
                          style={{ width: 150 }}
                        />
                      ),
                    },
                    '.',
                  ]
                : ['.']),
            ]}
            hint="A data de termo é o gatilho mais importante: dispara alertas de renovação e janela de denúncia."
          />

          {/* Renovação */}
          {dataTermo && (
            <InlineSentenceField
              fragments={[
                'Renovação automática:',
                {
                  type: 'toggle',
                  checked: renovacao,
                  onLabel: 'sim',
                  offLabel: 'não',
                  onChange: setRenovacao,
                },
                ...(renovacao
                  ? [
                      ' em ciclos de',
                      {
                        type: 'number' as const,
                        value: renovQty,
                        min: 1,
                        max: 120,
                        onChange: setRenovQty,
                        placeholder: '12',
                      },
                      {
                        type: 'select' as const,
                        value: renovUnidade,
                        options: UNIDADES_RENOV,
                        width: 90,
                        onChange: (v: string) =>
                          setRenovUnidade(v === 'anos' ? 'anos' : 'meses'),
                      },
                      '.',
                    ]
                  : ['.']),
              ]}
              hint={
                renovacao
                  ? 'Quando atingir o termo, o sistema cria automaticamente um novo dataTermo somando o ciclo.'
                  : 'Sem renovação automática, o contrato termina na data de termo.'
              }
            />
          )}

          {/* Janela de denúncia */}
          {dataTermo && renovacao && (
            <InlineSentenceField
              fragments={[
                'Para denunciar a renovação, avisar com pelo menos',
                {
                  type: 'number',
                  value: denunciaDias,
                  min: 1,
                  max: 365,
                  onChange: setDenunciaDias,
                  placeholder: '60',
                  width: 70,
                },
                'dias antes do termo.',
              ]}
              hint="O sistema cria automaticamente uma data-chave de tipo JANELA_DENUNCIA_INICIO."
            />
          )}
        </div>
        <InlineFieldsStyles />
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" loading={submitting} onClick={() => void submit()}>
          Gravar
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
