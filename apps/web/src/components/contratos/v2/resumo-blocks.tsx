'use client'

/**
 * Blocos do tab Resumo do contract detail v2.
 *
 * Filosofia: cada bloco devolve apenas dados accionáveis. Campos
 * vazios são omitidos (não "—"). Datas em prosa ("renova em 8 dias"
 * vs "Data termo: 30/06/2026"). Compliance angolano é destaque.
 *
 * Componentes exportados:
 *  - <ResumoIdentificacao />: tipo, valor, vigência em prosa
 *  - <ResumoPartes />: lista compacta com papel + entidade
 *  - <ResumoCompliance />: TGIS, BNA, AGT, registos, notário
 *  - <ResumoProximosEventos />: datas-chave + obrigações + actos
 *  - <ResumoCustomFields />: campos custom do tipo
 */

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import {
  Users,
  ShieldCheck,
  Bell,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { fmtMoney } from '@/lib/clm-format'
import { CustomFieldsDrawer } from './custom-fields-drawer'

interface ContratoFull {
  id: string
  titulo: string
  descricao: string | null
  numero: string | null
  estado: string
  valor: string | null
  moeda: string | null
  leiAplicavel: string | null
  foro: string | null
  dataAssinatura: string | null
  dataInicioVigencia: string | null
  dataTermo: string | null
  renovacaoAutomatica: boolean
  prazoRenovacaoMeses: number | null
  janelaDenunciaDias: number | null
  tipo: { id: string; nome: string } | null
  carteira: { id: string; nome: string } | null
  responsavel: { id: string; firstName: string; lastName: string } | null
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function fmtDateHuman(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtDaysHuman(dias: number): string {
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  if (dias > 1) return `em ${dias} dias`
  return `há ${Math.abs(dias)} dias`
}

// ─── Identificação ───────────────────────────────────────────────

export function ResumoIdentificacao({ contrato }: { contrato: ContratoFull }) {
  const now = new Date()
  const termo = contrato.dataTermo ? new Date(contrato.dataTermo) : null
  const inicio = contrato.dataInicioVigencia
    ? new Date(contrato.dataInicioVigencia)
    : null
  const assinatura = contrato.dataAssinatura
    ? new Date(contrato.dataAssinatura)
    : null
  const diasTermo = termo ? daysBetween(now, termo) : null

  return (
    <Block icon={Tag} title="Identificação">
      <dl className="r-dl">
        {contrato.tipo && (
          <Row label="Tipo" value={contrato.tipo.nome} />
        )}
        {contrato.carteira && (
          <Row label="Carteira" value={contrato.carteira.nome} />
        )}
        {contrato.responsavel && (
          <Row
            label="Responsável"
            value={`${contrato.responsavel.firstName} ${contrato.responsavel.lastName}`}
          />
        )}
        {contrato.valor && (
          <Row
            label="Valor"
            value={fmtMoney(contrato.valor, contrato.moeda)}
          />
        )}
        {assinatura && (
          <Row label="Assinatura" value={fmtDateHuman(contrato.dataAssinatura) ?? '—'} />
        )}
        {inicio && (
          <Row
            label="Início"
            value={fmtDateHuman(contrato.dataInicioVigencia) ?? '—'}
          />
        )}
        {termo && (
          <Row
            label="Termo"
            value={
              <>
                <span>{fmtDateHuman(contrato.dataTermo)}</span>{' '}
                <span className={`r-rel ${diasTermo !== null && diasTermo <= 30 ? 'r-warn' : ''}`}>
                  ({fmtDaysHuman(diasTermo!)})
                </span>
              </>
            }
          />
        )}
        {contrato.renovacaoAutomatica && (
          <Row
            label="Renovação"
            value={
              contrato.prazoRenovacaoMeses
                ? `Automática (ciclos de ${contrato.prazoRenovacaoMeses}m)`
                : 'Automática'
            }
          />
        )}
        {contrato.janelaDenunciaDias && (
          <Row
            label="Janela denúncia"
            value={`${contrato.janelaDenunciaDias} dias antes do termo`}
          />
        )}
      </dl>
      {contrato.descricao && (
        <div className="r-desc">{contrato.descricao}</div>
      )}
      <style jsx>{`
        .r-dl {
          margin: 0;
          display: grid;
          grid-template-columns: minmax(110px, max-content) 1fr;
          row-gap: 8px;
          column-gap: 16px;
          font-size: 12px;
        }
        .r-rel {
          color: var(--k2-text-mute);
          font-size: 11px;
        }
        .r-warn {
          color: var(--k2-warn);
        }
        .r-desc {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--k2-border);
          font-size: 12px;
          color: var(--k2-text-dim);
          line-height: 1.5;
          white-space: pre-wrap;
        }
      `}</style>
    </Block>
  )
}

// ─── Partes ──────────────────────────────────────────────────────

interface ParteRow {
  id: string
  papel: string
  ordem: number
  entidade: { id: string; nome: string }
}
interface PartesResponse {
  data: ParteRow[]
}

export function ResumoPartes({ contratoId }: { contratoId: string }) {
  const { data: session } = useSession()
  const [partes, setPartes] = useState<ParteRow[] | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return
    api<PartesResponse>(`/contratos/${contratoId}/partes`, {
      token: session.accessToken,
    })
      .then((r) => setPartes(r.data ?? []))
      .catch(() => setPartes([]))
  }, [contratoId, session?.accessToken])

  return (
    <Block icon={Users} title="Partes">
      {partes === null ? (
        <Skeleton lines={2} />
      ) : partes.length === 0 ? (
        <Empty hint="Sem partes registadas." />
      ) : (
        <div className="p-list">
          {partes.map((p) => (
            <Link
              key={p.id}
              href={`/entidades/${p.entidade.id}`}
              className="p-item"
            >
              <div className="p-item-text">
                <div className="p-item-name">{p.entidade.nome}</div>
                <div className="p-item-papel">{prettyPapel(p.papel)}</div>
              </div>
              <ChevronRight size={11} />
            </Link>
          ))}
        </div>
      )}
      <style jsx>{`
        .p-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .p-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          text-decoration: none;
          transition: border-color 120ms ease, background 120ms ease;
        }
        .p-item:hover {
          border-color: var(--k2-border-strong);
          background: var(--k2-bg-hover);
        }
        .p-item-text {
          flex: 1;
          min-width: 0;
        }
        .p-item-name {
          font-size: 13px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .p-item-papel {
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-top: 1px;
        }
      `}</style>
    </Block>
  )
}

function prettyPapel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase().replaceAll('_', ' ')
}

// ─── Compliance angolano ─────────────────────────────────────────

interface ActoRegulatorio {
  id: string
  tipo: string
  estado: string
  observacoes: string | null
  tgisVerbaNumero: string | null
  valorLiquidar: string | null
  baseTributavel: string | null
  baseMoeda: string | null
  detectadoAutomaticamente: boolean
}

export function ResumoCompliance({ contratoId }: { contratoId: string }) {
  const { data: session } = useSession()
  const [actos, setActos] = useState<ActoRegulatorio[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!session?.accessToken) return
    try {
      const r = await api<{ data: ActoRegulatorio[] } | ActoRegulatorio[]>(
        `/compliance/contratos/${contratoId}/actos`,
        { token: session.accessToken },
      )
      const list = Array.isArray(r) ? r : r.data
      setActos(list ?? [])
    } catch {
      setActos([])
    }
  }, [contratoId, session?.accessToken])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateActo = async (actoId: string, action: 'concluir' | 'em-curso' | 'inaplicavel') => {
    if (!session?.accessToken) return
    setBusy(actoId)
    try {
      await api(`/compliance/actos/${actoId}/${action}`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({}),
      })
      await reload()
    } catch {
      // silent — uma reload mostrará o estado real do servidor
    } finally {
      setBusy(null)
    }
  }

  const pendentes = actos?.filter((a) => a.estado === 'PENDENTE').length ?? 0

  return (
    <Block
      icon={ShieldCheck}
      title="Compliance angolano"
      badge={
        actos === null
          ? undefined
          : pendentes > 0
            ? `${pendentes} pendente${pendentes === 1 ? '' : 's'}`
            : `${actos.length}`
      }
    >
      {actos === null ? (
        <Skeleton lines={3} />
      ) : actos.length === 0 ? (
        <Empty hint="Sem actos regulatórios detectados. O engine corre quando o contrato muda de estado ou recebe valor/tipo." />
      ) : (
        <div className="c-list">
          {actos.map((a) => (
            <ActoRow
              key={a.id}
              acto={a}
              busy={busy === a.id}
              onAction={(act) => void updateActo(a.id, act)}
            />
          ))}
        </div>
      )}
      <style jsx>{`
        .c-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
      `}</style>
    </Block>
  )
}

function ActoRow({
  acto,
  busy,
  onAction,
}: {
  acto: ActoRegulatorio
  busy?: boolean
  onAction?: (action: 'concluir' | 'em-curso' | 'inaplicavel') => void
}) {
  const StatusIcon =
    acto.estado === 'CONCLUIDO'
      ? CheckCircle2
      : acto.estado === 'BLOQUEADO'
        ? AlertTriangle
        : Circle
  const statusColor =
    acto.estado === 'CONCLUIDO'
      ? 'var(--k2-good)'
      : acto.estado === 'BLOQUEADO'
        ? 'var(--k2-bad)'
        : acto.estado === 'EM_CURSO'
          ? 'var(--k2-warn)'
          : 'var(--k2-text-mute)'

  const titulo = prettyTipoActo(acto.tipo)
  const subtitle = [
    acto.tgisVerbaNumero ? `Verba ${acto.tgisVerbaNumero}` : null,
    acto.estado === 'PENDENTE' ? 'Pendente' : null,
    acto.estado === 'EM_CURSO' ? 'Em curso' : null,
    acto.estado === 'CONCLUIDO' ? 'Concluído' : null,
    acto.estado === 'DISPENSADO' ? 'Dispensado' : null,
    acto.estado === 'INAPLICAVEL' ? 'Inaplicável' : null,
    acto.estado === 'BLOQUEADO' ? 'Bloqueado' : null,
    acto.detectadoAutomaticamente ? 'Auto-detectado' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const showActions =
    onAction && (acto.estado === 'PENDENTE' || acto.estado === 'EM_CURSO')

  return (
    <div className="acto-row">
      <StatusIcon
        size={14}
        className="acto-icon"
        style={{ color: statusColor }}
      />
      <div className="acto-text">
        <div className="acto-titulo">{titulo}</div>
        <div className="acto-sub">{subtitle}</div>
        {acto.valorLiquidar && (
          <div className="acto-valor">
            {fmtMoney(acto.valorLiquidar, acto.baseMoeda)}
          </div>
        )}
      </div>
      {showActions && (
        <div className="acto-actions">
          {acto.estado === 'PENDENTE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction!('em-curso')}
              className="acto-btn"
              title="Marcar em curso"
            >
              Em curso
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction!('concluir')}
            className="acto-btn acto-btn-primary"
            title="Marcar como cumprido"
          >
            Concluir
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction!('inaplicavel')}
            className="acto-btn acto-btn-muted"
            title="Marcar como inaplicável (dispensar)"
          >
            Dispensar
          </button>
        </div>
      )}
      <style jsx>{`
        .acto-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px 10px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
        }
        .acto-icon {
          margin-top: 2px;
          flex-shrink: 0;
        }
        .acto-text {
          flex: 1;
          min-width: 0;
        }
        .acto-titulo {
          font-size: 13px;
          font-weight: 500;
          color: var(--k2-text);
        }
        .acto-sub {
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-top: 1px;
        }
        .acto-valor {
          font-size: 11px;
          color: var(--k2-text-dim);
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }
        .acto-actions {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }
        .acto-btn {
          padding: 3px 8px;
          font-size: 10px;
          font-family: inherit;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          color: var(--k2-text-dim);
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
        }
        .acto-btn:hover:not(:disabled) {
          background: var(--k2-bg-hover);
          color: var(--k2-text);
        }
        .acto-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .acto-btn-primary {
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border-color: var(--k2-accent);
        }
        .acto-btn-primary:hover:not(:disabled) {
          opacity: 0.85;
        }
        .acto-btn-muted {
          background: transparent;
        }
      `}</style>
    </div>
  )
}

function prettyTipoActo(t: string): string {
  const map: Record<string, string> = {
    IMPOSTO_DE_SELO: 'Imposto de Selo (TGIS)',
    REGISTO_PREDIAL: 'Registo Predial',
    REGISTO_COMERCIAL: 'Registo Comercial',
    REGISTO_AUTOMOVEL: 'Registo Automóvel',
    REGISTO_IAPI: 'Registo IAPI',
    BNA_LICENCIAMENTO: 'BNA — Licenciamento cambial',
    BNA_RJOC: 'BNA — RJOC (não-residentes)',
    AGT_RETENCAO_IRT: 'AGT — Retenção IRT na fonte',
    RECONHECIMENTO_NOTARIAL: 'Reconhecimento notarial',
    OUTRO: 'Outro acto regulatório',
  }
  return map[t] ?? t
}

// ─── Próximos eventos ────────────────────────────────────────────

interface DataChaveItem {
  id: string
  tipo: string
  data: string
  descricao: string | null
  cumprida: boolean
}
interface ObrigacaoItem {
  id: string
  tipo: string
  descricao: string
  proximaData: string | null
}

export function ResumoProximosEventos({ contratoId }: { contratoId: string }) {
  const { data: session } = useSession()
  const [datas, setDatas] = useState<DataChaveItem[] | null>(null)
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoItem[] | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return
    Promise.all([
      api<{ data: DataChaveItem[] }>(`/contratos/${contratoId}/datas-chave`, {
        token: session.accessToken,
      }).catch(() => ({ data: [] })),
      api<{ data: ObrigacaoItem[] }>(`/contratos/${contratoId}/obrigacoes`, {
        token: session.accessToken,
      }).catch(() => ({ data: [] })),
    ]).then(([d, o]) => {
      setDatas(d.data ?? [])
      setObrigacoes(o.data ?? [])
    })
  }, [contratoId, session?.accessToken])

  if (datas === null || obrigacoes === null) {
    return (
      <Block icon={Bell} title="Próximos eventos">
        <Skeleton lines={3} />
      </Block>
    )
  }

  const now = new Date()
  type Event = {
    key: string
    label: string
    sub: string
    date: Date
    atrasada: boolean
  }
  const events: Event[] = []
  for (const d of datas.filter((x) => !x.cumprida)) {
    const date = new Date(d.data)
    const dias = daysBetween(now, date)
    events.push({
      key: `d-${d.id}`,
      label: prettyTipoData(d.tipo),
      sub: d.descricao ?? '',
      date,
      atrasada: dias < 0,
    })
  }
  for (const o of obrigacoes) {
    if (!o.proximaData) continue
    const date = new Date(o.proximaData)
    const dias = daysBetween(now, date)
    events.push({
      key: `o-${o.id}`,
      label: prettyTipoObr(o.tipo),
      sub: o.descricao,
      date,
      atrasada: dias < 0,
    })
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())
  const top = events.slice(0, 6)

  return (
    <Block
      icon={Bell}
      title="Próximos eventos"
      badge={events.length > 0 ? `${events.length}` : undefined}
    >
      {top.length === 0 ? (
        <Empty hint="Sem eventos futuros." />
      ) : (
        <div className="e-list">
          {top.map((e) => {
            const dias = daysBetween(now, e.date)
            return (
              <div key={e.key} className={`e-row ${e.atrasada ? 'atrasada' : ''}`}>
                <div className="e-date">
                  <div className="e-day">{e.date.getDate()}</div>
                  <div className="e-month">
                    {e.date.toLocaleDateString('pt-PT', { month: 'short' })}
                  </div>
                </div>
                <div className="e-text">
                  <div className="e-label">{e.label}</div>
                  {e.sub && <div className="e-sub">{e.sub}</div>}
                </div>
                <div className="e-rel">
                  {e.atrasada ? 'em atraso' : fmtDaysHuman(dias)}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {events.length > 6 && (
        <div className="e-more">+{events.length - 6} eventos. Ver tab Eventos.</div>
      )}
      <style jsx>{`
        .e-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .e-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px;
          border-radius: var(--k2-radius-sm);
        }
        .e-row.atrasada {
          background: rgba(220, 38, 38, 0.06);
        }
        .e-date {
          width: 36px;
          text-align: center;
          flex-shrink: 0;
        }
        .e-day {
          font-size: 16px;
          font-weight: 600;
          color: var(--k2-text);
          line-height: 1;
        }
        .e-month {
          font-size: 9px;
          color: var(--k2-text-mute);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .e-text {
          flex: 1;
          min-width: 0;
        }
        .e-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--k2-text);
        }
        .e-sub {
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-top: 1px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .e-rel {
          font-size: 10px;
          color: var(--k2-text-mute);
          flex-shrink: 0;
        }
        .e-row.atrasada .e-rel {
          color: var(--k2-bad);
        }
        .e-more {
          margin-top: 8px;
          font-size: 11px;
          color: var(--k2-text-mute);
          text-align: center;
        }
      `}</style>
    </Block>
  )
}

function prettyTipoData(t: string): string {
  const map: Record<string, string> = {
    ASSINATURA: 'Assinatura',
    INICIO_VIGENCIA: 'Início de vigência',
    TERMO: 'Termo do contrato',
    RENOVACAO_AUTOMATICA: 'Renovação automática',
    JANELA_DENUNCIA_INICIO: 'Início da janela de denúncia',
    JANELA_DENUNCIA_FIM: 'Fim da janela de denúncia',
    PAGAMENTO: 'Pagamento',
    ENTREGA: 'Entrega',
    REVISAO_PRECO: 'Revisão de preço',
    MILESTONE: 'Milestone',
    GARANTIA_VALIDADE: 'Validade da garantia',
    SEGURO_VALIDADE: 'Validade do seguro',
    OUTRO: 'Evento',
  }
  return map[t] ?? t
}

function prettyTipoObr(t: string): string {
  const map: Record<string, string> = {
    PAGAMENTO_PERIODICO: 'Pagamento',
    REPORTE: 'Reporte',
    GARANTIA_VALIDADE: 'Garantia',
    SEGURO_VALIDADE: 'Seguro',
    SLA: 'SLA',
    ENTREGA_PERIODICA: 'Entrega',
    OUTRO: 'Obrigação',
  }
  return map[t] ?? t
}

// ─── Custom fields ───────────────────────────────────────────────

interface CustomFieldsResponse {
  definition: {
    id: string
    key: string
    label: string
    hint: string | null
    type: string
  }
  value: { v?: unknown } | { rua?: string; cidade?: string } | null
}

export function ResumoCustomFields({ contratoId }: { contratoId: string }) {
  const { data: session } = useSession()
  const [items, setItems] = useState<CustomFieldsResponse[] | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const load = useCallback(async () => {
    if (!session?.accessToken) return
    try {
      const rows = await api<CustomFieldsResponse[]>(
        `/custom-fields/by-contrato/${contratoId}`,
        { token: session.accessToken },
      )
      setItems(rows)
    } catch {
      setItems([])
    }
  }, [contratoId, session?.accessToken])

  useEffect(() => {
    void load()
  }, [load])

  // Esconde o bloco completamente quando não há custom fields definidos
  // para este tipo — não queremos "Sem custom fields" a ocupar espaço
  // se o tipo nunca foi configurado.
  if (items === null || items.length === 0) return null

  return (
    <>
      <Block
        icon={Sparkles}
        title="Detalhes do tipo"
        action={<EditarBtn onClick={() => setEditorOpen(true)} />}
      >
        <dl className="r-dl">
          {items.map((it) => (
            <Row
              key={it.definition.id}
              label={it.definition.label}
              value={renderCustomValue(it.definition.type, it.value)}
              hint={it.definition.hint ?? undefined}
            />
          ))}
        </dl>
        <style jsx>{`
          .r-dl {
            margin: 0;
            display: grid;
            grid-template-columns: minmax(110px, max-content) 1fr;
            row-gap: 8px;
            column-gap: 16px;
            font-size: 12px;
          }
        `}</style>
      </Block>
      <CustomFieldsDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        contratoId={contratoId}
        onSaved={() => void load()}
      />
    </>
  )
}

function renderCustomValue(
  type: string,
  raw: CustomFieldsResponse['value'],
): React.ReactNode {
  if (!raw) return <span className="cf-empty">—</span>
  if (type === 'ADDRESS') {
    const addr = raw as { rua?: string; cidade?: string; provincia?: string }
    return [addr.rua, addr.cidade, addr.provincia].filter(Boolean).join(', ')
  }
  if (type === 'MONEY') {
    const m = raw as { v?: number; moeda?: string }
    if (typeof m.v !== 'number') return '—'
    return fmtMoney(m.v.toString(), m.moeda ?? null)
  }
  const v = (raw as { v?: unknown }).v
  if (type === 'BOOLEAN') {
    return v === true ? 'Sim' : v === false ? 'Não' : '—'
  }
  if (type === 'DATE' && typeof v === 'string') {
    return fmtDateHuman(v) ?? v
  }
  if (v === undefined || v === null || v === '') return <span className="cf-empty">—</span>
  return String(v)
}

// ─── Primitives ──────────────────────────────────────────────────

function Block({
  icon: Icon,
  title,
  badge,
  action,
  children,
}: {
  icon: React.ElementType
  title: string
  badge?: string
  /** Acção do canto direito do header (e.g. "Editar"). */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bl">
      <header className="bl-head">
        <Icon size={13} className="bl-icon" />
        <span className="bl-title">{title}</span>
        {badge && <span className="bl-badge">{badge}</span>}
        {action && <div className="bl-action">{action}</div>}
      </header>
      <div className="bl-body">{children}</div>
      <style jsx>{`
        .bl {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          padding: 14px 16px;
        }
        .bl-head {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 12px;
        }
        .bl-icon {
          color: var(--k2-text-mute);
        }
        .bl-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--k2-text-mute);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .bl-badge {
          display: inline-grid;
          place-items: center;
          min-width: 18px;
          height: 18px;
          padding: 0 6px;
          background: var(--k2-bg-elev-2);
          border-radius: 999px;
          font-size: 10px;
          color: var(--k2-text);
          font-weight: 500;
        }
        .bl-action {
          margin-left: auto;
        }
        .bl-body {
          font-size: 13px;
          color: var(--k2-text);
        }
      `}</style>
    </section>
  )
}

function Row({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <>
      <dt className="r-dt" title={hint}>
        {label}
      </dt>
      <dd className="r-dd">{value}</dd>
      <style jsx>{`
        .r-dt {
          color: var(--k2-text-mute);
          font-size: 11px;
          padding-top: 1px;
        }
        .r-dd {
          margin: 0;
          color: var(--k2-text);
          font-size: 12px;
        }
      `}</style>
    </>
  )
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="emp">
      {hint}
      <style jsx>{`
        .emp {
          font-size: 11px;
          color: var(--k2-text-mute);
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

function EditarBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ed-btn" title="Editar">
      Editar
      <style jsx>{`
        .ed-btn {
          background: transparent;
          border: none;
          color: var(--k2-text-dim);
          font-size: 11px;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
        }
        .ed-btn:hover {
          color: var(--k2-text);
          text-decoration: underline;
        }
      `}</style>
    </button>
  )
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="sk">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="sk-line" />
      ))}
      <style jsx>{`
        .sk {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sk-line {
          height: 12px;
          background: var(--k2-bg);
          border-radius: 4px;
          opacity: 0.4;
          animation: sk-pulse 1.4s ease-in-out infinite;
        }
        @keyframes sk-pulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}
