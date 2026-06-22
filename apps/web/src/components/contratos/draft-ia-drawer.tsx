'use client'

/**
 * Drawer "Redigir com IA" — pede a Claude um draft completo do
 * corpo do contrato.
 *
 * Fluxo:
 *  1. Editor passa contratoId + versaoId activa
 *  2. Utilizador escreve instruções específicas (opcional) — e.g.
 *     "incluir cláusula de exclusividade", "valores em USD"
 *  3. Escolhe: actualizar versão actual ou criar nova versão DRAFT
 *  4. POST /ia/draft-contrato → server faz prompt-engineering,
 *     chama Claude, devolve markdown + versaoId persistida
 *  5. Editor recebe o markdown via callback → mostra no textarea
 *     + marca dirty=false (já está persistido)
 *
 * Caso ANTHROPIC_API_KEY ausente, server devolve esqueleto com
 * placeholders [A COMPLETAR — ...] sem partir nada.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'

export interface DraftResult {
  versaoId: string
  versao: {
    id: string
    versao: string
    ordem: number
    corpoMarkdown: string | null
    geradoPorIA: boolean
  }
  criada: boolean
  modelo: string
  tokensInput: number
  tokensOutput: number
  stubbed: boolean
}

export function DraftIaDrawer({
  open,
  onClose,
  contratoId,
  versaoIdActiva,
  podeEditarVersao,
  onDrafted,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  /** Versão actualmente seleccionada no editor (se houver). */
  versaoIdActiva: string | null
  /** True se a versão actual pode ser editada (sem assinaturas). */
  podeEditarVersao: boolean
  onDrafted: (result: DraftResult) => void
}) {
  const { data: session } = useSession()
  const [prompt, setPrompt] = useState('')
  // Default: cria nova versão se não há versão activa OU se a actual
  // já está assinada. Caso contrário deixa o user escolher.
  const [novaVersao, setNovaVersao] = useState(
    !versaoIdActiva || !podeEditarVersao,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stubWarning, setStubWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPrompt('')
      setError(null)
      setStubWarning(null)
      setNovaVersao(!versaoIdActiva || !podeEditarVersao)
    }
  }, [open, versaoIdActiva, podeEditarVersao])

  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true)
    setError(null)
    setStubWarning(null)
    try {
      const result = await api<DraftResult>('/ia/draft-contrato', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          contratoId,
          versaoId: novaVersao ? undefined : versaoIdActiva ?? undefined,
          prompt: prompt.trim() || undefined,
          novaVersao,
        }),
      })
      if (result.stubbed) {
        setStubWarning(
          'IA em modo stub (sem ANTHROPIC_API_KEY) — esqueleto com placeholders [A COMPLETAR]. Configura a chave em produção para draft real.',
        )
        // Damos tempo ao utilizador de ler o aviso antes de fechar
        setTimeout(() => {
          onDrafted(result)
          onClose()
        }, 1500)
      } else {
        onDrafted(result)
        onClose()
      }
    } catch (e) {
      setError(
        (e as { error?: string })?.error ??
          'Não foi possível gerar o draft. Tenta novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const editPathDescription = novaVersao
    ? 'Vai criar uma nova versão DRAFT, mantendo a actual intacta.'
    : 'Vai sobrescrever o conteúdo da versão actual (não assinada).'

  return (
    <Drawer open={open} onClose={onClose} width={580}>
      <DrawerHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} /> Redigir com IA
          </span>
        }
        subtitle="Claude gera o corpo do contrato a partir dos dados do resumo, das partes e das tuas instruções."
        onClose={onClose}
      />
      <DrawerBody>
        {error && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {stubWarning && (
          <div style={{ background: 'rgba(217,119,6,0.12)', color: '#92400e', border: '1px solid rgba(217,119,6,0.3)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {stubWarning}
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
          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            A IA usa o título, descrição, tipo, partes, valores, lei e foro do
            contrato (tab Resumo) como base, mais cláusulas-padrão da
            biblioteca aprovadas neste tenant. Devolve o markdown — sempre
            revê antes de assinar.
          </div>
        </div>

        <form
          id="draft-ia-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Instruções adicionais (opcional)
            <Textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex.: Incluir cláusula de exclusividade territorial em Luanda · Pagamento mensal a 30 dias · Foro arbitragem CACAL · Indemnização de 6 meses em caso de denúncia antecipada"
            />
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginBottom: 4 }}>
              Destino
            </legend>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="radio"
                name="destino"
                checked={novaVersao}
                onChange={() => setNovaVersao(true)}
              />
              Criar nova versão DRAFT
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                opacity: !versaoIdActiva || !podeEditarVersao ? 0.5 : 1,
              }}
            >
              <input
                type="radio"
                name="destino"
                checked={!novaVersao}
                onChange={() => setNovaVersao(false)}
                disabled={!versaoIdActiva || !podeEditarVersao}
              />
              Substituir conteúdo da versão actual
              {!versaoIdActiva && (
                <span style={{ color: 'var(--k2-text-mute)', fontSize: 11 }}>
                  (sem versão activa)
                </span>
              )}
              {versaoIdActiva && !podeEditarVersao && (
                <span style={{ color: 'var(--k2-text-mute)', fontSize: 11 }}>
                  (já assinada — bloqueado)
                </span>
              )}
            </label>
            <p style={{ fontSize: 11, color: 'var(--k2-text-mute)', margin: '4px 0 0' }}>
              {editPathDescription}
            </p>
          </fieldset>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          form="draft-ia-form"
          loading={submitting}
          leftIcon={<Sparkles size={13} />}
        >
          Gerar com IA
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}
