'use client'

/**
 * DenunciarButton — confirma e regista denúncia tempestiva.
 *
 * UX:
 *  1. Click → modal com aviso + textarea de motivo (opcional)
 *  2. Confirma → POST /contratos/:id/denunciar
 *  3. Sucesso → callback onDone, fecha modal
 *
 * Apenas aparece em contratos ACTIVOs com renovação automática
 * e ainda sem denúncia. O hide é feito pelo parent — este componente
 * assume que faz sentido mostrar.
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'

export function DenunciarButton({
  contratoId,
  onDone,
}: {
  contratoId: string
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const confirmar = async () => {
    if (!session?.accessToken) return
    setSubmitting(true)
    setErr(null)
    try {
      await api(`/contratos/${contratoId}/denunciar`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ motivo: motivo.trim() || undefined }),
      })
      setOpen(false)
      setMotivo('')
      onDone()
    } catch (e: unknown) {
      const msg =
        (typeof e === 'object' && e && 'error' in e
          ? String((e as { error: unknown }).error)
          : null) ?? (e instanceof Error ? e.message : 'Erro a denunciar')
      setErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        leftIcon={<AlertTriangle size={14} />}
        onClick={() => setOpen(true)}
        title="Bloquear a próxima renovação tácita"
      >
        Denunciar
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--k2-bg-elev)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius)',
              padding: 24,
              width: 480,
              maxWidth: 'calc(100vw - 32px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
                  Denunciar contrato
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--k2-text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--k2-text-dim)', margin: 0, lineHeight: 1.6 }}>
              Esta acção <strong>bloqueia</strong> a renovação automática deste contrato.
              No próximo termo, o sistema não vai renovar — terás de tomar a decisão
              manualmente (renovação negociada, terminação, ou adenda).
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--k2-text-dim)', fontWeight: 500 }}>
                Motivo da denúncia (opcional)
              </span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: Renegociação de termos comerciais antes da renovação."
                style={{
                  background: 'var(--k2-bg)',
                  color: 'var(--k2-text)',
                  border: '1px solid var(--k2-border)',
                  borderRadius: 'var(--k2-radius-sm)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
                {motivo.length}/500
              </span>
            </label>

            {err && (
              <div
                style={{
                  padding: 10,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--k2-radius-sm)',
                  fontSize: 12,
                  color: '#fca5a5',
                }}
              >
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmar} loading={submitting}>
                Confirmar denúncia
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
