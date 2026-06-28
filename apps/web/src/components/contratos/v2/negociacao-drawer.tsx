'use client'

/**
 * Drawer de negociação — acção primária da fase NEGOCIACAO.
 *
 * Lista os pontos em aberto, permite registar um novo ponto (cláusula,
 * a nossa posição vs. a da contraparte) e resolver um ponto com o
 * acordo final. Substitui o encaminhamento provisório para a IA.
 *
 *  GET   /contratos/:id/negociacao
 *  POST  /contratos/:id/negociacao        { clausulaRef, titulo, resumo, posicaoNos?, posicaoContraparte?, criticidade? }
 *  PATCH /contratos/:id/negociacao/:ponto { estado, acordoFinal? }
 */

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import {
  NegociacaoPontoCriticidade,
  NegociacaoPontoEstado,
} from '@kamaia/shared-types'

interface Ponto {
  id: string
  clausulaRef: string
  titulo: string
  resumo: string
  posicaoNos: string | null
  posicaoContraparte: string | null
  estado: NegociacaoPontoEstado
  criticidade: NegociacaoPontoCriticidade | null
  acordoFinal: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  contratoId: string
  onChanged?: () => void
}

const ESTADO_LABELS: Record<NegociacaoPontoEstado, string> = {
  ABERTO: 'Aberto',
  PROPOSTO: 'Proposto',
  CONTRA_PROPOSTO: 'Contraproposto',
  ACEITE: 'Aceite',
  REJEITADO: 'Rejeitado',
  RETIRADO: 'Retirado',
}

const CRIT_LABELS: Record<NegociacaoPontoCriticidade, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
}

const RESOLVIDOS: NegociacaoPontoEstado[] = [
  NegociacaoPontoEstado.ACEITE,
  NegociacaoPontoEstado.REJEITADO,
  NegociacaoPontoEstado.RETIRADO,
]

export function NegociacaoDrawer({ open, onClose, contratoId, onChanged }: Props) {
  const { data: session } = useSession()
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [clausulaRef, setClausulaRef] = useState('')
  const [titulo, setTitulo] = useState('')
  const [resumo, setResumo] = useState('')
  const [posicaoNos, setPosicaoNos] = useState('')
  const [posicaoContraparte, setPosicaoContraparte] = useState('')
  const [criticidade, setCriticidade] = useState<NegociacaoPontoCriticidade>(
    NegociacaoPontoCriticidade.MEDIA,
  )
  const [saving, setSaving] = useState(false)
  // Resolução in-line do acordo (substitui o window.prompt).
  const [resolvendo, setResolvendo] = useState<string | null>(null)
  const [acordoTexto, setAcordoTexto] = useState('')

  const load = useCallback(async () => {
    if (!session?.accessToken) return
    setLoading(true)
    try {
      const res = await api<unknown>(`/contratos/${contratoId}/negociacao`, {
        token: session.accessToken,
      })
      setPontos(unwrapList<Ponto>(res))
      setErr(null)
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao carregar pontos')
    } finally {
      setLoading(false)
    }
  }, [contratoId, session?.accessToken])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const resetForm = () => {
    setClausulaRef('')
    setTitulo('')
    setResumo('')
    setPosicaoNos('')
    setPosicaoContraparte('')
    setCriticidade(NegociacaoPontoCriticidade.MEDIA)
    setShowForm(false)
  }

  const criar = async () => {
    if (!session?.accessToken) return
    if (clausulaRef.trim().length < 1 || titulo.trim().length < 2 || resumo.trim().length < 2) {
      setErr('Preenche cláusula, título e resumo.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await api(`/contratos/${contratoId}/negociacao`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          clausulaRef: clausulaRef.trim(),
          titulo: titulo.trim(),
          resumo: resumo.trim(),
          posicaoNos: posicaoNos.trim() || undefined,
          posicaoContraparte: posicaoContraparte.trim() || undefined,
          criticidade,
        }),
      })
      resetForm()
      await load()
      onChanged?.()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao registar o ponto')
    } finally {
      setSaving(false)
    }
  }

  const aplicar = async (
    ponto: Ponto,
    estado: NegociacaoPontoEstado,
    acordoFinal?: string,
  ) => {
    if (!session?.accessToken) return
    try {
      await api(`/contratos/${contratoId}/negociacao/${ponto.id}`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({ estado, acordoFinal: acordoFinal?.trim() || undefined }),
      })
      setResolvendo(null)
      setAcordoTexto('')
      await load()
      onChanged?.()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao resolver o ponto')
    }
  }

  const abertos = pontos.filter((p) => !RESOLVIDOS.includes(p.estado))
  const resolvidos = pontos.filter((p) => RESOLVIDOS.includes(p.estado))

  return (
    <Drawer open={open} onClose={onClose} width={680}>
      <DrawerHeader
        title="Negociação"
        subtitle="Pontos em aberto com a contraparte — a nossa posição vs. a deles."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div className="ng-err">{err}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--k2-text-mute)' }}>
            {loading ? 'A carregar…' : `${abertos.length} em aberto · ${resolvidos.length} resolvidos`}
          </span>
          {!showForm && (
            <Button type="button" variant="secondary" leftIcon={<Plus size={13} />} onClick={() => setShowForm(true)}>
              Novo ponto
            </Button>
          )}
        </div>

        {showForm && (
          <div className="ng-form">
            <div className="ng-grid">
              <label className="ng-field" style={{ maxWidth: 180 }}>
                <span className="ng-label">Cláusula *</span>
                <input className="ng-input" value={clausulaRef} onChange={(e) => setClausulaRef(e.target.value)} placeholder="Ex.: 7.2" maxLength={200} />
              </label>
              <label className="ng-field">
                <span className="ng-label">Criticidade</span>
                <select className="ng-input" value={criticidade} onChange={(e) => setCriticidade(e.target.value as NegociacaoPontoCriticidade)}>
                  {Object.values(NegociacaoPontoCriticidade).map((c) => (
                    <option key={c} value={c}>{CRIT_LABELS[c]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="ng-field">
              <span className="ng-label">Título *</span>
              <input className="ng-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Limite de responsabilidade" maxLength={200} />
            </label>
            <label className="ng-field">
              <span className="ng-label">Resumo *</span>
              <textarea className="ng-input" value={resumo} onChange={(e) => setResumo(e.target.value)} rows={2} maxLength={5000} placeholder="O que está em discussão." style={{ resize: 'vertical' }} />
            </label>
            <div className="ng-grid">
              <label className="ng-field">
                <span className="ng-label">A nossa posição</span>
                <textarea className="ng-input" value={posicaoNos} onChange={(e) => setPosicaoNos(e.target.value)} rows={2} maxLength={5000} style={{ resize: 'vertical' }} />
              </label>
              <label className="ng-field">
                <span className="ng-label">Posição da contraparte</span>
                <textarea className="ng-input" value={posicaoContraparte} onChange={(e) => setPosicaoContraparte(e.target.value)} rows={2} maxLength={5000} style={{ resize: 'vertical' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
              <Button type="button" loading={saving} onClick={() => void criar()}>Registar ponto</Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {pontos.length === 0 && !loading && (
            <div className="ng-empty">Sem pontos de negociação registados.</div>
          )}
          {[...abertos, ...resolvidos].map((p) => {
            const resolvido = RESOLVIDOS.includes(p.estado)
            return (
              <div key={p.id} className="ng-card" style={{ opacity: resolvido ? 0.7 : 1 }}>
                <div className="ng-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="ng-claus">{p.clausulaRef}</span>
                    <strong style={{ fontSize: 13 }}>{p.titulo}</strong>
                    <span className={`ng-badge ${resolvido ? 'res' : 'open'}`}>{ESTADO_LABELS[p.estado]}</span>
                    {p.criticidade && <span className="ng-badge crit">{CRIT_LABELS[p.criticidade]}</span>}
                  </div>
                  {!resolvido && resolvendo !== p.id && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="ng-act ok"
                        title="Aceitar"
                        onClick={() => {
                          setResolvendo(p.id)
                          setAcordoTexto('')
                        }}
                      >
                        <Check size={14} />
                      </button>
                      <button type="button" className="ng-act no" title="Rejeitar" onClick={() => void aplicar(p, NegociacaoPontoEstado.REJEITADO)}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="ng-resumo">{p.resumo}</p>
                {(p.posicaoNos || p.posicaoContraparte) && (
                  <div className="ng-pos">
                    {p.posicaoNos && <div><span>Nós:</span> {p.posicaoNos}</div>}
                    {p.posicaoContraparte && <div><span>Eles:</span> {p.posicaoContraparte}</div>}
                  </div>
                )}
                {p.acordoFinal && <div className="ng-acordo">Acordo: {p.acordoFinal}</div>}
                {resolvendo === p.id && (
                  <div className="ng-resolve">
                    <textarea
                      className="ng-input"
                      value={acordoTexto}
                      onChange={(e) => setAcordoTexto(e.target.value)}
                      rows={2}
                      maxLength={5000}
                      placeholder="Acordo final (opcional)"
                      autoFocus
                      style={{ resize: 'vertical', width: '100%' }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <Button type="button" variant="secondary" onClick={() => setResolvendo(null)}>
                        Cancelar
                      </Button>
                      <Button type="button" onClick={() => void aplicar(p, NegociacaoPontoEstado.ACEITE, acordoTexto)}>
                        Aceitar com acordo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <style jsx>{`
          .ng-err { background: rgba(220,38,38,0.08); color: var(--k2-bad); padding: 10px 14px; border-radius: var(--k2-radius-sm); font-size: 12px; margin-bottom: 12px; }
          .ng-form { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 14px; display: flex; flex-direction: column; gap: 12px; }
          .ng-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .ng-field { display: flex; flex-direction: column; gap: 5px; }
          .ng-label { font-size: 11.5px; font-weight: 500; color: var(--k2-text-dim); }
          .ng-input { background: var(--k2-bg); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 8px 11px; font-size: 13px; font-family: inherit; color: var(--k2-text); outline: none; }
          .ng-input:focus { border-color: var(--k2-accent); }
          .ng-empty { padding: 24px; text-align: center; color: var(--k2-text-mute); font-size: 12px; border: 1px dashed var(--k2-border); border-radius: var(--k2-radius); }
          .ng-card { background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 12px 14px; }
          .ng-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
          .ng-claus { font-family: var(--font-mono, monospace); font-size: 11px; color: var(--k2-accent); background: var(--k2-bg-elev-2); padding: 2px 7px; border-radius: 5px; }
          .ng-badge { font-size: 10.5px; font-weight: 500; padding: 2px 8px; border-radius: 5px; }
          .ng-badge.open { background: var(--k2-warn-bg, rgba(180,130,20,0.12)); color: var(--k2-warn); }
          .ng-badge.res { background: var(--k2-bg-elev-2); color: var(--k2-text-mute); }
          .ng-badge.crit { background: var(--k2-bg-elev-2); color: var(--k2-text-dim); }
          .ng-act { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--k2-border); background: var(--k2-bg); cursor: pointer; color: var(--k2-text-mute); }
          .ng-act.ok:hover { color: var(--k2-ok, #2faa6a); border-color: var(--k2-ok, #2faa6a); }
          .ng-act.no:hover { color: var(--k2-bad); border-color: var(--k2-bad); }
          .ng-resumo { font-size: 12.5px; color: var(--k2-text-dim); margin: 8px 0 0; }
          .ng-pos { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--k2-text-dim); }
          .ng-pos span { color: var(--k2-text-mute); font-weight: 500; }
          .ng-acordo { margin-top: 8px; font-size: 12px; color: var(--k2-ok, #2faa6a); }
          .ng-resolve { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--k2-border); }
        `}</style>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Fechar</Button>
      </DrawerFooter>
    </Drawer>
  )
}
