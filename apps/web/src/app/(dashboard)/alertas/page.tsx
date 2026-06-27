'use client'

/**
 * Kamaia CLM — Painel de alertas.
 *
 * Vista única que combina:
 *   - Contratos a expirar em janelas críticas (30d, 90d)
 *   - Datas-chave próximas (janela de denúncia, pagamento, entrega)
 *   - Actos regulatórios pendentes (IS, Registos, BNA, AGT)
 *
 * Cada bloco linka ao contrato. A intenção é que o utilizador comece
 * o dia aqui — se não há nada urgente, está em paz; se há, sabe
 * exactamente onde clicar.
 */

import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import {
  ActoEstado,
  ActoRegulatorioTipo,
  ACTO_REGULATORIO_LABELS,
  ContratoEstado,
} from '@kamaia/shared-types'
import { Badge } from '@/components/ui/badge'
import { fmtDate, fmtMoney } from '@/lib/clm-format'
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  Hourglass,
} from 'lucide-react'
import { CommandCenter } from './command-center'
import type { PortfolioContrato } from './portfolio-engine'

interface DashboardData {
  total: number
  porEstado: Record<string, number>
  expiraEm30: number
  expiraEm90: number
  denunciaEm60: number
  actosPendentes: number
}

interface ExpirantContrato {
  id: string
  numeroInterno: string
  titulo: string
  estado: ContratoEstado
  dataTermo: string | null
  renovacaoAutomatica: boolean
  tipo?: { codigo: string; nome: string }
}

interface ContratosList {
  data: ExpirantContrato[]
  total: number
}

interface PendingActo {
  id: string
  contratoId: string
  tipo: ActoRegulatorioTipo
  estado: ActoEstado
  prazoLimite: string | null
  valorLiquidar: string | null
  tgisVerbaNumero: string | null
  referenciaLegal: string | null
  contrato?: { id: string; numeroInterno: string; titulo: string }
}

export default function AlertasPage() {
  const { data: dashboard } = useApi<DashboardData>('/contratos/dashboard')
  const { data: expira30 } = useApi<ContratosList>('/contratos?expiraEm=30&limit=20')
  const { data: expira90 } = useApi<ContratosList>('/contratos?expiraEm=90&limit=20')
  const { data: actosPendentes, refetch: refetchActos } = useApi<PendingActo[]>(
    '/compliance/pendentes?dias=30',
  )

  // Contratos a expirar (30+90, deduplicados) para o Command Center.
  const contratosExpirar: PortfolioContrato[] = (() => {
    const all = [...(expira30?.data ?? []), ...(expira90?.data ?? [])]
    const seen = new Set<string>()
    const out: PortfolioContrato[] = []
    for (const c of all) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push({
        id: c.id,
        numeroInterno: c.numeroInterno,
        titulo: c.titulo,
        dataTermo: c.dataTermo,
        renovacaoAutomatica: c.renovacaoAutomatica,
      })
    }
    return out
  })()

  const expira30List = expira30?.data ?? []
  const expira90Only = (expira90?.data ?? []).filter(
    (c) => !expira30List.some((e) => e.id === c.id),
  )
  const actosCriticos = (actosPendentes ?? []).filter((a) => {
    if (!a.prazoLimite) return false
    const dias = Math.ceil(
      (new Date(a.prazoLimite).getTime() - Date.now()) / 86_400_000,
    )
    return dias <= 7
  })
  const actosProximos = (actosPendentes ?? []).filter((a) => {
    if (!a.prazoLimite) return false
    const dias = Math.ceil(
      (new Date(a.prazoLimite).getTime() - Date.now()) / 86_400_000,
    )
    return dias > 7 && dias <= 30
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Calendário</h1>
        <p style={{ color: 'var(--k2-text-mute)', fontSize: 13, margin: '4px 0 0 0' }}>
          A tua fila de acção — o que a carteira precisa de ti, por urgência.
        </p>
      </header>

      {/* Command Center — fila priorizada de toda a carteira */}
      <CommandCenter
        actos={actosPendentes ?? []}
        contratos={contratosExpirar}
        onResolved={() => void refetchActos()}
      />

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <KPI
          label="A expirar em 30 dias"
          value={dashboard?.expiraEm30 ?? 0}
          icon={AlertTriangle}
          tone={(dashboard?.expiraEm30 ?? 0) > 0 ? 'warn' : 'mute'}
        />
        <KPI
          label="A expirar em 90 dias"
          value={dashboard?.expiraEm90 ?? 0}
          icon={Calendar}
          tone="mute"
        />
        <KPI
          label="Janela denúncia (60d)"
          value={dashboard?.denunciaEm60 ?? 0}
          icon={Hourglass}
          tone={(dashboard?.denunciaEm60 ?? 0) > 0 ? 'warn' : 'mute'}
        />
        <KPI
          label="Actos pendentes"
          value={dashboard?.actosPendentes ?? 0}
          icon={Clock}
          tone={(dashboard?.actosPendentes ?? 0) > 0 ? 'warn' : 'mute'}
        />
      </div>

      {/* Blocos de detalhe */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Block
          title="Contratos a expirar em ≤30 dias"
          subtitle="Prioridade máxima — janela curta para acção."
          tone="warn"
          emptyText="Nenhum contrato a expirar este mês."
          items={expira30List}
          renderItem={(c) => <ExpirantRow key={c.id} c={c} />}
        />
        <Block
          title="Actos regulatórios críticos (≤7 dias)"
          subtitle="IS por liquidar, registos pendentes, autorizações BNA."
          tone="warn"
          emptyText="Nenhum acto crítico."
          items={actosCriticos}
          renderItem={(a) => <ActoRow key={a.id} a={a} />}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Block
          title="Contratos a expirar em 31-90 dias"
          subtitle="Planeamento de renovação ou denúncia."
          tone="info"
          emptyText="Nada planeado para os próximos 90 dias."
          items={expira90Only}
          renderItem={(c) => <ExpirantRow key={c.id} c={c} />}
        />
        <Block
          title="Actos regulatórios próximos (8-30 dias)"
          subtitle="Tempo para agir sem urgência."
          tone="info"
          emptyText="Nenhum acto próximo."
          items={actosProximos}
          renderItem={(a) => <ActoRow key={a.id} a={a} />}
        />
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ────────────────────────────────

function KPI({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ElementType
  tone: 'warn' | 'info' | 'mute'
}) {
  const color =
    tone === 'warn'
      ? '#f59e0b'
      : tone === 'info'
        ? 'var(--k2-accent)'
        : 'var(--k2-text-mute)'
  return (
    <div
      style={{
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} color={color} />
        <div style={{ fontSize: 12, color: 'var(--k2-text-mute)' }}>{label}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: tone === 'mute' ? 'var(--k2-text)' : color }}>
        {value}
      </div>
    </div>
  )
}

function Block<T>({
  title,
  subtitle,
  tone,
  emptyText,
  items,
  renderItem,
}: {
  title: string
  subtitle: string
  tone: 'warn' | 'info'
  emptyText: string
  items: T[]
  renderItem: (item: T) => React.ReactNode
}) {
  const borderColor =
    tone === 'warn' ? 'rgba(245, 158, 11, 0.3)' : 'var(--k2-border)'
  return (
    <div
      style={{
        background: 'var(--k2-bg-elev)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--k2-radius)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{title}</h2>
        <p style={{ color: 'var(--k2-text-mute)', fontSize: 12, margin: '4px 0 0 0' }}>
          {subtitle}
        </p>
      </div>
      {items.length === 0 ? (
        <div
          style={{
            color: 'var(--k2-text-mute)',
            fontSize: 12,
            padding: '20px 0',
            textAlign: 'center',
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.slice(0, 8).map(renderItem)}
          {items.length > 8 && (
            <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', textAlign: 'center', padding: 6 }}>
              + {items.length - 8} mais
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExpirantRow({ c }: { c: ExpirantContrato }) {
  const dias = c.dataTermo
    ? Math.ceil((new Date(c.dataTermo).getTime() - Date.now()) / 86_400_000)
    : null
  const corDias =
    dias === null
      ? 'var(--k2-text-mute)'
      : dias <= 7
        ? '#ef4444'
        : dias <= 30
          ? '#f59e0b'
          : 'var(--k2-text-mute)'

  return (
    <Link
      href={`/contratos/${c.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--k2-bg)',
        border: '1px solid var(--k2-border)',
        borderRadius: 6,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <FileText size={14} color="var(--k2-text-mute)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{c.numeroInterno}</div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--k2-text-mute)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {c.titulo}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: corDias }}>
          {dias !== null ? `${dias}d` : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--k2-text-mute)' }}>
          {c.dataTermo ? fmtDate(c.dataTermo) : '—'}
        </div>
      </div>
      {c.renovacaoAutomatica && <Badge>Auto-renova</Badge>}
    </Link>
  )
}

function ActoRow({ a }: { a: PendingActo }) {
  const dias = a.prazoLimite
    ? Math.ceil((new Date(a.prazoLimite).getTime() - Date.now()) / 86_400_000)
    : null
  const corDias =
    dias === null
      ? 'var(--k2-text-mute)'
      : dias <= 0
        ? '#ef4444'
        : dias <= 7
          ? '#ef4444'
          : dias <= 14
            ? '#f59e0b'
            : 'var(--k2-text-mute)'

  return (
    <Link
      href={`/contratos/${a.contratoId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--k2-bg)',
        border: '1px solid var(--k2-border)',
        borderRadius: 6,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>
            {ACTO_REGULATORIO_LABELS[a.tipo]}
          </span>
          {a.tgisVerbaNumero && <Badge>Verba {a.tgisVerbaNumero}</Badge>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
          {a.contrato?.numeroInterno ?? '—'} · {a.contrato?.titulo ?? ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {a.valorLiquidar && (
          <div style={{ fontSize: 11, fontWeight: 500 }}>
            {fmtMoney(a.valorLiquidar, 'AOA')}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 500, color: corDias }}>
          {dias !== null ? `${dias}d` : '—'}
        </div>
      </div>
    </Link>
  )
}
