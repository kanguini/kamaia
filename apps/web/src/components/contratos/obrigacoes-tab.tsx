'use client'

/**
 * Tab Obrigações — activa a feature dormente do modelo
 * ContratoObrigacao + Instancia. Gap #8 da auditoria.
 *
 * Mostra:
 *  - Lista de obrigações activas (pagamento mensal, reportes,
 *    SLAs, garantias, etc.)
 *  - Instâncias por obrigação (últimas 12) com estado + acções
 *  - Botão "Nova obrigação" → Drawer com parte responsável,
 *    tipo, periodicidade, valor, próxima data
 *  - Por instância: "Marcar cumprida" (data, valor, comprovativo
 *    via Dropzone, observações) ou "Dispensar" (motivo).
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, CheckCircle2, XCircle, Calendar } from 'lucide-react'
import {
  ObrigacaoTipo,
  ObrigacaoPeriodicidade,
  ObrigacaoInstanciaEstado,
} from '@kamaia/shared-types'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import {
  DocumentDropzone,
  type UploadedDocument,
} from '@/components/ui/document-dropzone'
import { fmtDate, fmtMoney } from '@/lib/clm-format'

const TIPO_LABELS: Record<ObrigacaoTipo, string> = {
  [ObrigacaoTipo.PAGAMENTO_PERIODICO]: 'Pagamento periódico',
  [ObrigacaoTipo.REPORTE]: 'Reporte',
  [ObrigacaoTipo.GARANTIA_VALIDADE]: 'Garantia (validade)',
  [ObrigacaoTipo.SEGURO_VALIDADE]: 'Seguro (validade)',
  [ObrigacaoTipo.SLA]: 'SLA',
  [ObrigacaoTipo.ENTREGA_PERIODICA]: 'Entrega periódica',
  [ObrigacaoTipo.OUTRO]: 'Outro',
}

const PERIODICIDADE_LABELS: Record<ObrigacaoPeriodicidade, string> = {
  [ObrigacaoPeriodicidade.UNICA]: 'Única',
  [ObrigacaoPeriodicidade.MENSAL]: 'Mensal',
  [ObrigacaoPeriodicidade.BIMESTRAL]: 'Bimestral',
  [ObrigacaoPeriodicidade.TRIMESTRAL]: 'Trimestral',
  [ObrigacaoPeriodicidade.SEMESTRAL]: 'Semestral',
  [ObrigacaoPeriodicidade.ANUAL]: 'Anual',
}

interface Instancia {
  id: string
  dataPrevista: string
  dataReal: string | null
  estado: ObrigacaoInstanciaEstado
  valorReal: string | null
  comprovativoId: string | null
  observacoes: string | null
}

interface Obrigacao {
  id: string
  tipo: ObrigacaoTipo
  descricao: string
  periodicidade: ObrigacaoPeriodicidade
  proximaData: string | null
  ultimaData: string | null
  valorEsperado: string | null
  moeda: string | null
  parteResponsavelId: string
  parteResponsavel: {
    entidade: { nome: string }
  } | null
  instancias: Instancia[]
}

interface ParteOpt {
  id: string
  papel: string
  entidade: { nome: string }
}

export function ObrigacoesTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<Obrigacao[]>([])
  const [partes, setPartes] = useState<ParteOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [novaOpen, setNovaOpen] = useState(false)
  const [cumprir, setCumprir] = useState<{ obrigacao: Obrigacao; instancia: Instancia } | null>(null)
  const [dispensar, setDispensar] = useState<{ obrigacao: Obrigacao; instancia: Instancia } | null>(null)

  const fetchAll = async () => {
    if (status !== 'authenticated' || !session?.accessToken) return
    setLoading(true)
    try {
      const [o, p] = await Promise.all([
        api<Obrigacao[]>(`/contratos/${contratoId}/obrigacoes`, { token: session.accessToken }),
        api<ParteOpt[]>(`/contratos/${contratoId}/partes`, { token: session.accessToken }),
      ])
      setItems(o ?? [])
      setPartes(p ?? [])
      setError(null)
    } catch (e) {
      setError((e as { error?: string })?.error ?? 'Erro a carregar obrigações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, session?.accessToken, status])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>
          {items.length} obrigação(ões) activa(s). Cada uma gera instâncias
          periódicas que entram nos alertas de vencimento.
        </div>
        <Button leftIcon={<Plus size={14} />} onClick={() => setNovaOpen(true)}>
          Nova obrigação
        </Button>
      </div>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, color: 'var(--k2-text-mute)' }}>A carregar…</div>
      ) : items.length === 0 ? (
        <div style={{ background: 'var(--k2-bg-elev)', border: '1px dashed var(--k2-border)', borderRadius: 'var(--k2-radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--k2-text-mute)', fontSize: 13 }}>
          Sem obrigações registadas. Cria a primeira para começares a seguir pagamentos/reportes/SLAs.
        </div>
      ) : (
        items.map((o) => (
          <ObrigacaoCard
            key={o.id}
            obrigacao={o}
            onCumprir={(inst) => setCumprir({ obrigacao: o, instancia: inst })}
            onDispensar={(inst) => setDispensar({ obrigacao: o, instancia: inst })}
          />
        ))
      )}

      <NovaObrigacaoDrawer
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        contratoId={contratoId}
        partes={partes}
        onDone={async () => {
          setNovaOpen(false)
          await fetchAll()
        }}
      />

      {cumprir && (
        <CumprirDrawer
          ctx={cumprir}
          contratoId={contratoId}
          onClose={() => setCumprir(null)}
          onDone={async () => {
            setCumprir(null)
            await fetchAll()
          }}
        />
      )}

      {dispensar && (
        <DispensarDrawer
          ctx={dispensar}
          contratoId={contratoId}
          onClose={() => setDispensar(null)}
          onDone={async () => {
            setDispensar(null)
            await fetchAll()
          }}
        />
      )}
    </div>
  )
}

// ─── Card por obrigação ───────────────────────────

function ObrigacaoCard({
  obrigacao,
  onCumprir,
  onDispensar,
}: {
  obrigacao: Obrigacao
  onCumprir: (inst: Instancia) => void
  onDispensar: (inst: Instancia) => void
}) {
  return (
    <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>{obrigacao.descricao}</span>
            <Badge variant="info">{TIPO_LABELS[obrigacao.tipo]}</Badge>
            <Badge variant="default">{PERIODICIDADE_LABELS[obrigacao.periodicidade]}</Badge>
          </div>
          <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 4 }}>
            Responsável: {obrigacao.parteResponsavel?.entidade.nome ?? '—'}
            {obrigacao.valorEsperado && (
              <> · Valor esperado: {fmtMoney(obrigacao.valorEsperado, obrigacao.moeda ?? undefined)}</>
            )}
            {obrigacao.proximaData && <> · Próxima: {fmtDate(obrigacao.proximaData)}</>}
          </div>
        </div>
      </div>

      {obrigacao.instancias.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Últimas instâncias
          </div>
          {obrigacao.instancias.slice(0, 6).map((i) => (
            <InstanciaRow
              key={i.id}
              instancia={i}
              onCumprir={() => onCumprir(i)}
              onDispensar={() => onDispensar(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InstanciaRow({
  instancia,
  onCumprir,
  onDispensar,
}: {
  instancia: Instancia
  onCumprir: () => void
  onDispensar: () => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '8px 10px',
        background: 'var(--k2-bg)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius-sm)',
        fontSize: 12,
        opacity:
          instancia.estado === ObrigacaoInstanciaEstado.DISPENSADA ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={12} color="var(--k2-text-mute)" />
        <span>{fmtDate(instancia.dataPrevista)}</span>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <InstanciaBadge estado={instancia.estado} />
        {instancia.dataReal && (
          <span style={{ color: 'var(--k2-text-mute)' }}>Real: {fmtDate(instancia.dataReal)}</span>
        )}
        {instancia.valorReal && (
          <span style={{ color: 'var(--k2-text-mute)' }}>Valor: {fmtMoney(instancia.valorReal)}</span>
        )}
        {instancia.observacoes && (
          <span style={{ color: 'var(--k2-text-dim)', fontSize: 11, fontStyle: 'italic' }}>
            {instancia.observacoes.slice(0, 80)}
          </span>
        )}
      </div>
      {instancia.estado === ObrigacaoInstanciaEstado.PENDENTE && (
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button
            onClick={onCumprir}
            title="Marcar cumprida"
            style={inlineBtn('#16a34a')}
          >
            <CheckCircle2 size={11} />
          </button>
          <button
            onClick={onDispensar}
            title="Dispensar"
            style={inlineBtn('var(--k2-bad)')}
          >
            <XCircle size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

function InstanciaBadge({ estado }: { estado: ObrigacaoInstanciaEstado }) {
  switch (estado) {
    case ObrigacaoInstanciaEstado.PENDENTE:  return <Badge variant="warning">Pendente</Badge>
    case ObrigacaoInstanciaEstado.CUMPRIDA:  return <Badge variant="success">Cumprida</Badge>
    case ObrigacaoInstanciaEstado.ATRASADA:  return <Badge variant="danger">Atrasada</Badge>
    case ObrigacaoInstanciaEstado.DISPENSADA: return <Badge variant="default">Dispensada</Badge>
    default: return <Badge variant="default">{estado}</Badge>
  }
}

function inlineBtn(color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--k2-border)',
    color,
    padding: '4px 6px',
    borderRadius: 'var(--k2-radius-sm)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  }
}

// ─── Drawer Nova Obrigação ────────────────────────

function NovaObrigacaoDrawer({
  open,
  onClose,
  contratoId,
  partes,
  onDone,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  partes: ParteOpt[]
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [parteResponsavelId, setParteResponsavelId] = useState('')
  const [tipo, setTipo] = useState<ObrigacaoTipo>(ObrigacaoTipo.PAGAMENTO_PERIODICO)
  const [descricao, setDescricao] = useState('')
  const [periodicidade, setPeriodicidade] = useState<ObrigacaoPeriodicidade>(ObrigacaoPeriodicidade.MENSAL)
  const [proximaData, setProximaData] = useState('')
  const [valor, setValor] = useState('')
  const [moeda, setMoeda] = useState('AOA')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setParteResponsavelId('')
      setTipo(ObrigacaoTipo.PAGAMENTO_PERIODICO)
      setDescricao('')
      setPeriodicidade(ObrigacaoPeriodicidade.MENSAL)
      setProximaData('')
      setValor('')
      setMoeda('AOA')
      setErr(null)
    }
  }, [open])

  const submit = async () => {
    if (!session?.accessToken) return
    if (!parteResponsavelId) { setErr('Indica a parte responsável.'); return }
    if (!descricao.trim()) { setErr('Indica a descrição.'); return }
    setSubmitting(true)
    setErr(null)
    try {
      let valorCentavos: string | undefined
      if (valor.trim()) {
        const p = Number(valor)
        if (!Number.isFinite(p) || p < 0) {
          setErr('Valor inválido — usa um número não-negativo.')
          return
        }
        valorCentavos = String(Math.round(p * 100))
      }
      await api(`/contratos/${contratoId}/obrigacoes`, {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          parteResponsavelId,
          tipo,
          descricao: descricao.trim(),
          periodicidade,
          proximaData: proximaData || undefined,
          valorEsperado: valorCentavos,
          moeda: moeda || undefined,
        }),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao criar obrigação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={560}>
      <DrawerHeader
        title="Nova obrigação"
        subtitle="Pagamento periódico, reporte, SLA, garantia — qualquer compromisso recorrente do contrato."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}
        <form id="nova-obrigacao-form" onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 14 }}>
          <FieldLabel label="Parte responsável *">
            <Select value={parteResponsavelId} onChange={(e) => setParteResponsavelId(e.target.value)} required>
              <option value="">Selecciona…</option>
              {partes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.entidade.nome} ({p.papel.replaceAll('_', ' ').toLowerCase()})
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="Descrição *">
            <Textarea
              rows={2}
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Pagamento mensal de avença consultoria"
            />
          </FieldLabel>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldLabel label="Tipo">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as ObrigacaoTipo)}>
                {Object.values(ObrigacaoTipo).map((t) => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </Select>
            </FieldLabel>
            <FieldLabel label="Periodicidade">
              <Select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as ObrigacaoPeriodicidade)}>
                {Object.values(ObrigacaoPeriodicidade).map((p) => (
                  <option key={p} value={p}>{PERIODICIDADE_LABELS[p]}</option>
                ))}
              </Select>
            </FieldLabel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <FieldLabel label="Valor esperado (em kwanzas)">
              <Input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" />
            </FieldLabel>
            <FieldLabel label="Moeda">
              <Select value={moeda} onChange={(e) => setMoeda(e.target.value)}>
                <option value="AOA">AOA</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </FieldLabel>
          </div>

          <FieldLabel label="Próxima data">
            <Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} />
          </FieldLabel>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="nova-obrigacao-form" loading={submitting}>Criar</Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Cumprir Drawer ──────────────────────────────

function CumprirDrawer({
  ctx,
  contratoId,
  onClose,
  onDone,
}: {
  ctx: { obrigacao: Obrigacao; instancia: Instancia }
  contratoId: string
  onClose: () => void
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [dataReal, setDataReal] = useState(new Date().toISOString().slice(0, 10))
  const [valorReal, setValorReal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [comprovativo, setComprovativo] = useState<UploadedDocument | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true)
    setErr(null)
    try {
      let valorCentavos: string | undefined
      if (valorReal.trim()) {
        const p = Number(valorReal)
        if (!Number.isFinite(p) || p < 0) {
          setErr('Valor inválido — usa um número não-negativo.')
          return
        }
        valorCentavos = String(Math.round(p * 100))
      }
      await api(`/contratos/${contratoId}/obrigacoes/instancias/${ctx.instancia.id}/cumprir`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({
          dataReal,
          valorReal: valorCentavos,
          comprovativoId: comprovativo?.id,
          observacoes: observacoes.trim() || undefined,
        }),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro a marcar cumprida.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open onClose={onClose} width={540}>
      <DrawerHeader
        title="Marcar instância cumprida"
        subtitle={`${ctx.obrigacao.descricao} · Prevista ${fmtDate(ctx.instancia.dataPrevista)}`}
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}
        <form id="cumprir-form" onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 14 }}>
          <FieldLabel label="Data real do cumprimento">
            <Input type="date" value={dataReal} onChange={(e) => setDataReal(e.target.value)} />
          </FieldLabel>
          <FieldLabel label={`Valor real (esperado: ${ctx.obrigacao.valorEsperado ? fmtMoney(ctx.obrigacao.valorEsperado, ctx.obrigacao.moeda ?? undefined) : 'n/a'})`}>
            <Input type="number" min={0} step="0.01" value={valorReal} onChange={(e) => setValorReal(e.target.value)} placeholder="0.00" />
          </FieldLabel>
          <FieldLabel label="Comprovativo (PDF/imagem)">
            <DocumentDropzone
              contratoId={contratoId}
              attached={comprovativo}
              onUploaded={(d) => setComprovativo(d)}
              onCleared={() => setComprovativo(null)}
            />
          </FieldLabel>
          <FieldLabel label="Observações">
            <Textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: pago em 15/06/2026 via transferência SISP ref. 90001234"
            />
          </FieldLabel>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="cumprir-form" loading={submitting}>Marcar cumprida</Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Dispensar Drawer ────────────────────────────

function DispensarDrawer({
  ctx,
  contratoId,
  onClose,
  onDone,
}: {
  ctx: { obrigacao: Obrigacao; instancia: Instancia }
  contratoId: string
  onClose: () => void
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!session?.accessToken) return
    if (motivo.trim().length < 5) { setErr('Motivo obrigatório (≥ 5 chars) para audit trail.'); return }
    setSubmitting(true)
    setErr(null)
    try {
      await api(`/contratos/${contratoId}/obrigacoes/instancias/${ctx.instancia.id}/dispensar`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro a dispensar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open onClose={onClose} width={500}>
      <DrawerHeader
        title="Dispensar instância"
        subtitle={`${ctx.obrigacao.descricao} · Prevista ${fmtDate(ctx.instancia.dataPrevista)}`}
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}
        <form id="dispensar-form" onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 14 }}>
          <FieldLabel label="Motivo (fica no audit trail) *">
            <Textarea
              rows={5}
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Contraparte solicitou suspensão temporária por escrito (carta de 10/06/2026)"
            />
          </FieldLabel>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="dispensar-form" loading={submitting}>Dispensar</Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Helpers ────────────────────────────────────

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
      {label}
      {children}
    </label>
  )
}
