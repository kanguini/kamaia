'use client'

/**
 * Tab Compliance — engine angolano accionável.
 *
 * O motor `ComplianceEngine` aplica regras versionadas (CIS/TGIS,
 * registos, BNA, AGT, notário) e cria actos `PENDENTE` no contrato.
 * Esta tab transforma esses cards estáticos em fluxo accionável:
 *
 *  - Filter por estado (Todos / Pendente / Em curso / Concluído /
 *    Não aplicável)
 *  - Botão "Avaliar agora" → re-corre o engine (idempotente, só
 *    adiciona novos actos)
 *  - Por acto: dropdown "Acções"
 *      • Marcar em curso (diligência iniciada)
 *      • Marcar concluído (Drawer: observações, custo, comprovativo)
 *      • Não aplicável (Drawer: motivo — exigido para audit trail)
 *      • Agendar prazo (Drawer: data + descrição)
 *  - Disclaimer permanente: o engine SUGERE, o utilizador decide
 *
 * Tudo persiste via PATCH/POST nos novos endpoints da Fase H, com
 * audit log + evento na timeline + webhook por mudança.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Calendar,
  ShieldAlert,
} from 'lucide-react'
import {
  ActoEstado,
  ACTO_REGULATORIO_LABELS,
  ActoRegulatorioTipo,
} from '@kamaia/shared-types'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { fmtDate, fmtMoney } from '@/lib/clm-format'

interface Acto {
  id: string
  tipo: ActoRegulatorioTipo
  estado: ActoEstado
  referenciaLegal: string | null
  prazoLimite: string | null
  valorLiquidar: string | null
  custoEmAKZ: string | null
  observacoes: string | null
  detectadoAutomaticamente: boolean
  concluidoEm: string | null
  responsavelId: string | null
  comprovativoId: string | null
}

type Filter = 'TODOS' | ActoEstado

type ActionKind = 'concluir' | 'em-curso' | 'inaplicavel' | 'agendar'

export function ComplianceTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<Acto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reavaliando, setReavaliando] = useState(false)
  const [filter, setFilter] = useState<Filter>('TODOS')
  const [drawer, setDrawer] = useState<{ kind: ActionKind; acto: Acto } | null>(null)

  const fetchActos = async () => {
    if (status !== 'authenticated' || !session?.accessToken) return
    setLoading(true)
    try {
      const data = await api<Acto[]>(
        `/compliance/contratos/${contratoId}/actos`,
        { token: session.accessToken },
      )
      setItems(data ?? [])
      setError(null)
    } catch (e) {
      setError((e as { error?: string })?.error ?? 'Erro a carregar compliance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchActos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, session?.accessToken, status])

  const reavaliar = async () => {
    if (!session?.accessToken) return
    setReavaliando(true)
    try {
      const result = await api<{ adicionados: number; totalSugeridos: number }>(
        `/compliance/contratos/${contratoId}/avaliar`,
        { method: 'POST', token: session.accessToken },
      )
      await fetchActos()
      if (result.adicionados === 0) {
        // Soft feedback — sem novos actos, o estado actual já estava completo
      }
    } catch (e) {
      alert((e as { error?: string })?.error ?? 'Erro a re-avaliar')
    } finally {
      setReavaliando(false)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'TODOS') return items
    return items.filter((a) => a.estado === filter)
  }, [items, filter])

  const counts = useMemo(() => {
    const c = { pendente: 0, emCurso: 0, concluido: 0, naoAplicavel: 0 }
    for (const a of items) {
      if (a.estado === ActoEstado.PENDENTE) c.pendente++
      else if (a.estado === ActoEstado.EM_CURSO) c.emCurso++
      else if (a.estado === ActoEstado.CONCLUIDO) c.concluido++
      else if (a.estado === ActoEstado.NAO_APLICAVEL) c.naoAplicavel++
    }
    return c
  }, [items])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: 'rgba(217,119,6,0.10)',
          border: '1px solid rgba(217,119,6,0.25)',
          color: '#92400e',
          padding: '10px 14px',
          borderRadius: 'var(--k2-radius-sm)',
          fontSize: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          O motor de compliance <strong>sugere</strong> — todos os actos requerem
          confirmação humana. A lei vigente <strong>à data do facto tributário</strong>
          {' '}é a aplicável (não a data presente).
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterBtn active={filter === 'TODOS'}        onClick={() => setFilter('TODOS')}        label={`Todos (${items.length})`} />
          <FilterBtn active={filter === ActoEstado.PENDENTE}     onClick={() => setFilter(ActoEstado.PENDENTE)}     label={`Pendente (${counts.pendente})`}     variant="warning" />
          <FilterBtn active={filter === ActoEstado.EM_CURSO}     onClick={() => setFilter(ActoEstado.EM_CURSO)}     label={`Em curso (${counts.emCurso})`}      variant="info" />
          <FilterBtn active={filter === ActoEstado.CONCLUIDO}    onClick={() => setFilter(ActoEstado.CONCLUIDO)}    label={`Concluído (${counts.concluido})`}   variant="success" />
          <FilterBtn active={filter === ActoEstado.NAO_APLICAVEL} onClick={() => setFilter(ActoEstado.NAO_APLICAVEL)} label={`N/A (${counts.naoAplicavel})`}      variant="default" />
        </div>

        <Button
          variant="secondary"
          onClick={reavaliar}
          loading={reavaliando}
          leftIcon={<RefreshCw size={13} />}
          title="Aplica as regras do engine a este contrato e adiciona apenas os actos que ainda não existem."
        >
          Re-avaliar
        </Button>
      </div>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div
        style={{
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border)',
          borderRadius: 'var(--k2-radius)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 24, color: 'var(--k2-text-mute)' }}>A carregar…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--k2-text-mute)', fontSize: 13 }}>
            {items.length === 0
              ? 'Nenhum acto regulatório identificado. Usa “Re-avaliar” depois de preencher tipo, valores e partes.'
              : 'Sem actos neste filtro.'}
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((a) => (
              <ActoRow key={a.id} acto={a} onAction={(kind) => setDrawer({ kind, acto: a })} />
            ))}
          </ul>
        )}
      </div>

      <ActionDrawer
        ctx={drawer}
        onClose={() => setDrawer(null)}
        onDone={async () => {
          setDrawer(null)
          await fetchActos()
        }}
      />
    </div>
  )
}

// ─── Linha de acto ─────────────────────────────────

function ActoRow({
  acto,
  onAction,
}: {
  acto: Acto
  onAction: (kind: ActionKind) => void
}) {
  const concluida =
    acto.estado === ActoEstado.CONCLUIDO || acto.estado === ActoEstado.NAO_APLICAVEL

  return (
    <li
      style={{
        borderTop: '1px solid var(--k2-border)',
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'flex-start',
        opacity: acto.estado === ActoEstado.NAO_APLICAVEL ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500 }}>{ACTO_REGULATORIO_LABELS[acto.tipo]}</span>
          <EstadoBadge estado={acto.estado} />
          {acto.detectadoAutomaticamente && (
            <span style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              auto-detectado
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--k2-text-dim)' }}>
          {acto.prazoLimite && <span>Prazo: {fmtDate(acto.prazoLimite)}</span>}
          {acto.valorLiquidar && <span>A liquidar: {fmtMoney(acto.valorLiquidar)}</span>}
          {acto.custoEmAKZ && acto.custoEmAKZ !== acto.valorLiquidar && (
            <span>Custo: {fmtMoney(acto.custoEmAKZ)}</span>
          )}
          {acto.concluidoEm && <span>Concluído em {fmtDate(acto.concluidoEm)}</span>}
        </div>
        {acto.referenciaLegal && (
          <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{acto.referenciaLegal}</div>
        )}
        {acto.observacoes && (
          <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 4 }}>
            {acto.observacoes}
          </div>
        )}
      </div>

      {!concluida && <ActionsMenu onAction={onAction} estado={acto.estado} />}
    </li>
  )
}

function EstadoBadge({ estado }: { estado: ActoEstado }) {
  switch (estado) {
    case ActoEstado.PENDENTE:      return <Badge variant="warning">Pendente</Badge>
    case ActoEstado.EM_CURSO:      return <Badge variant="info">Em curso</Badge>
    case ActoEstado.CONCLUIDO:     return <Badge variant="success">Concluído</Badge>
    case ActoEstado.NAO_APLICAVEL: return <Badge variant="default">Não aplicável</Badge>
    case ActoEstado.DISPENSADO:    return <Badge variant="default">Dispensado</Badge>
    case ActoEstado.FALHOU:        return <Badge variant="danger">Falhou</Badge>
    case ActoEstado.EXPIRADO:      return <Badge variant="danger">Expirado</Badge>
    default:                       return <Badge variant="default">{estado}</Badge>
  }
}

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
  variant?: 'default' | 'warning' | 'info' | 'success'
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px',
        background: active ? 'var(--k2-bg-hover)' : 'transparent',
        border: `1px solid ${active ? 'var(--k2-border-strong)' : 'var(--k2-border)'}`,
        color: active ? 'var(--k2-text)' : 'var(--k2-text-dim)',
        borderRadius: 'var(--k2-radius-sm)',
        cursor: 'pointer',
        fontSize: 12,
      }}
    >
      {label}
    </button>
  )
}

function ActionsMenu({
  onAction,
  estado,
}: {
  onAction: (k: ActionKind) => void
  estado: ActoEstado
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '6px 10px',
          background: 'var(--k2-bg)',
          border: '1px solid var(--k2-border)',
          color: 'var(--k2-text)',
          borderRadius: 'var(--k2-radius-sm)',
          cursor: 'pointer',
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        Acções <ChevronDown size={11} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 10,
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border-strong)',
            borderRadius: 'var(--k2-radius-sm)',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)',
            minWidth: 200,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {estado !== ActoEstado.EM_CURSO && (
            <MenuItem
              icon={<PlayCircle size={13} />}
              label="Marcar em curso"
              onClick={() => {
                setOpen(false)
                onAction('em-curso')
              }}
            />
          )}
          <MenuItem
            icon={<CheckCircle2 size={13} color="#16a34a" />}
            label="Marcar concluído…"
            onClick={() => {
              setOpen(false)
              onAction('concluir')
            }}
          />
          <MenuItem
            icon={<Calendar size={13} />}
            label="Agendar prazo…"
            onClick={() => {
              setOpen(false)
              onAction('agendar')
            }}
          />
          <MenuItem
            icon={<XCircle size={13} color="#b91c1c" />}
            label="Não aplicável…"
            onClick={() => {
              setOpen(false)
              onAction('inaplicavel')
            }}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 0,
        color: 'var(--k2-text)',
        padding: '8px 10px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        borderRadius: 'var(--k2-radius-sm)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--k2-bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Action Drawers ────────────────────────────────

function ActionDrawer({
  ctx,
  onClose,
  onDone,
}: {
  ctx: { kind: ActionKind; acto: Acto } | null
  onClose: () => void
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Form fields (reset quando muda o ctx)
  const [observacoes, setObservacoes] = useState('')
  const [motivo, setMotivo] = useState('')
  const [custo, setCusto] = useState('')
  const [comprovativoId, setComprovativoId] = useState('')
  const [data, setData] = useState('')
  const [descricao, setDescricao] = useState('')

  useEffect(() => {
    if (!ctx) {
      setObservacoes('')
      setMotivo('')
      setCusto('')
      setComprovativoId('')
      setData('')
      setDescricao('')
      setErr(null)
      return
    }
    // Pre-preencher prazo com o prazo actual se houver
    if (ctx.kind === 'agendar' && ctx.acto.prazoLimite) {
      setData(ctx.acto.prazoLimite.slice(0, 10))
    }
  }, [ctx])

  if (!ctx) return <Drawer open={false} onClose={onClose} width={520}><></></Drawer>

  const { kind, acto } = ctx
  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true)
    setErr(null)
    try {
      let endpoint = ''
      let method: 'PATCH' | 'POST' = 'PATCH'
      let body: object = {}
      if (kind === 'concluir') {
        endpoint = `/compliance/actos/${acto.id}/concluir`
        const c = custo.trim()
        const centavos = c ? String(Math.round(Number(c.replace(',', '.')) * 100)) : undefined
        body = {
          observacoes: observacoes.trim() || undefined,
          custoEmAKZ: centavos,
          comprovativoId: comprovativoId.trim() || undefined,
        }
      } else if (kind === 'em-curso') {
        endpoint = `/compliance/actos/${acto.id}/em-curso`
        body = { observacoes: observacoes.trim() || undefined }
      } else if (kind === 'inaplicavel') {
        if (motivo.trim().length < 5) {
          setErr('Motivo obrigatório (mínimo 5 caracteres) — fica no audit trail.')
          setSubmitting(false)
          return
        }
        endpoint = `/compliance/actos/${acto.id}/inaplicavel`
        body = { motivo: motivo.trim() }
      } else if (kind === 'agendar') {
        if (!data) {
          setErr('Data obrigatória.')
          setSubmitting(false)
          return
        }
        endpoint = `/compliance/actos/${acto.id}/agendar-prazo`
        method = 'POST'
        body = { data, descricao: descricao.trim() || undefined }
      }
      await api(endpoint, {
        method,
        token: session.accessToken,
        body: JSON.stringify(body),
      })
      onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao gravar acção.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = TITLES[kind]
  const subtitle = ACTO_REGULATORIO_LABELS[acto.tipo]

  return (
    <Drawer open={true} onClose={onClose} width={520}>
      <DrawerHeader title={title} subtitle={subtitle} onClose={onClose} />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}

        <form
          id="compliance-action-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          {kind === 'concluir' && (
            <>
              <FieldLabel label="Custo em AKZ (opcional)">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={custo}
                  onChange={(e) => setCusto(e.target.value)}
                  placeholder="Ex.: 150000.50"
                />
                <small style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
                  Em kwanzas com ponto decimal. Será guardado em centavos (BigInt).
                </small>
              </FieldLabel>
              <FieldLabel label="ID comprovativo (opcional)">
                <Input
                  type="text"
                  value={comprovativoId}
                  onChange={(e) => setComprovativoId(e.target.value)}
                  placeholder="UUID do documento já anexado ao contrato"
                />
              </FieldLabel>
              <FieldLabel label="Observações">
                <Textarea
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex.: pago em 12/06/2026 via referência SISP 9000123456789"
                />
              </FieldLabel>
            </>
          )}

          {kind === 'em-curso' && (
            <FieldLabel label="Observações">
              <Textarea
                rows={4}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: pedido de liquidação submetido à AGT em 01/06/2026, aguarda referência"
              />
            </FieldLabel>
          )}

          {kind === 'inaplicavel' && (
            <FieldLabel label="Motivo (fica no audit trail)" required>
              <Textarea
                rows={4}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: parte isenta nos termos do art. X, conforme certidão Y junta ao contrato"
                required
                minLength={5}
              />
            </FieldLabel>
          )}

          {kind === 'agendar' && (
            <>
              <FieldLabel label="Data limite" required>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </FieldLabel>
              <FieldLabel label="Descrição (opcional)">
                <Input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={`Prazo ${acto.tipo.replaceAll('_', ' ').toLowerCase()} (compliance)`}
                />
                <small style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
                  Cria uma data-chave linkada — entra nos alertas de vencimento.
                </small>
              </FieldLabel>
            </>
          )}
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="compliance-action-form" loading={submitting}>
          {BTN_LABELS[kind]}
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}

const TITLES: Record<ActionKind, string> = {
  concluir: 'Marcar como concluído',
  'em-curso': 'Marcar como em curso',
  inaplicavel: 'Marcar como não aplicável',
  agendar: 'Agendar prazo',
}
const BTN_LABELS: Record<ActionKind, string> = {
  concluir: 'Concluir',
  'em-curso': 'Confirmar',
  inaplicavel: 'Marcar inaplicável',
  agendar: 'Agendar',
}

// ─── Helpers ───────────────────────────────────────

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
      {label}
      {required && <span style={{ color: 'var(--k2-bad)' }}>*</span>}
      {children}
    </label>
  )
}

