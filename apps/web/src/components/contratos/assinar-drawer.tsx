'use client'

/**
 * Drawer de assinatura — usado dentro da página pública /c/[token]
 * para o colaborador externo (tipoAcesso = ASSINATURA) assinar a
 * versão activa do contrato.
 *
 * Fluxo:
 *  1. Owner partilha o link → colaborador abre /c/<token>
 *  2. Clica "Assinar" → este drawer abre
 *  3. Preenche nome (obrigatório), BI/cargo (opcional), desenha
 *     assinatura, confirma
 *  4. POST /c/:token/assinar com método DESENHADA_BROWSER + imagem b64
 *  5. Server calcula hash do markdown da versão como prova de
 *     integridade e devolve a assinatura
 *
 * Decisão: confirma com checkbox explícito "li e concordo" antes do
 * submit (boa prática + ajuda probatória).
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { AssinaturaMetodo } from '@kamaia/shared-types'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSignature, ShieldCheck } from 'lucide-react'
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from './signature-canvas'

export function AssinarDrawer({
  open,
  onClose,
  token,
  versaoId,
  contratoTitulo,
  signatarioEmailHint,
  signatarioNomeHint,
  onSigned,
}: {
  open: boolean
  onClose: () => void
  token: string
  versaoId: string
  contratoTitulo: string
  signatarioEmailHint?: string | null
  signatarioNomeHint?: string | null
  onSigned: () => void
}) {
  const router = useRouter()
  const canvasRef = useRef<SignatureCanvasHandle>(null)
  const [nome, setNome] = useState(signatarioNomeHint ?? '')
  const [bi, setBi] = useState('')
  const [cargo, setCargo] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!nome.trim()) {
      setError('Indica o teu nome completo.')
      return
    }
    if (!agreed) {
      setError('Confirma a leitura do contrato.')
      return
    }
    const img = canvasRef.current?.getDataUrl()
    if (!img) {
      setError('Desenha a tua assinatura no campo.')
      return
    }

    setSubmitting(true)
    try {
      await api(`/c/${token}/assinar`, {
        method: 'POST',
        noTenant: true,
        body: JSON.stringify({
          versaoId,
          metodo: AssinaturaMetodo.DESENHADA_BROWSER,
          signatarioNome: nome.trim(),
          signatarioBI: bi.trim() || undefined,
          cargo: cargo.trim() || undefined,
          imagemBase64: img,
        }),
      })
      onSigned()
      onClose()
      // Refresh do contexto público para mostrar estado actualizado
      router.refresh()
    } catch (e) {
      setError(
        (e as { error?: string })?.error ??
          'Não foi possível registar a assinatura.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={620}>
      <DrawerHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FileSignature size={18} /> Assinar contrato
          </span>
        }
        subtitle={
          <>
            {contratoTitulo}
            <span style={{ color: 'var(--k2-text-mute)' }}> · {signatarioEmailHint}</span>
          </>
        }
        onClose={onClose}
      />
      <DrawerBody>
        {error && (
          <div style={{ background: 'var(--color-danger-bg, #fee2e2)', color: 'var(--color-danger-text, #991b1b)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div
          style={{
            background: 'var(--k2-bg-elev-2, #f8fafc)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            padding: '10px 14px',
            fontSize: 12,
            color: 'var(--k2-text-dim)',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            A tua assinatura electrónica fica associada à versão actual
            do contrato. O sistema regista a data, IP e um hash
            criptográfico do conteúdo no momento da assinatura — qualquer
            alteração posterior é detectável. Eficácia probatória ao
            abrigo da Lei n.º 1/11 (assinatura electrónica simples).
          </div>
        </div>

        <form
          id="assinar-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Nome completo *
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome conforme BI / passaporte"
              autoFocus
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
              BI / Passaporte (opcional)
              <Input value={bi} onChange={(e) => setBi(e.target.value)} placeholder="000000000LA000" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
              Cargo (opcional)
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Administrador" />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>
              Assinatura *
            </span>
            <SignatureCanvas ref={canvasRef} height={170} />
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12,
              color: 'var(--k2-text-dim)',
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              Confirmo que li e concordo com o conteúdo do contrato exibido
              acima nesta página. Compreendo que a minha assinatura tem
              eficácia jurídica.
            </span>
          </label>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          form="assinar-form"
          loading={submitting}
          disabled={!agreed || !nome.trim()}
          leftIcon={<FileSignature size={13} />}
        >
          Assinar agora
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
