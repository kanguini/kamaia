'use client'

/**
 * Kamaia CLM — Dashboard root.
 *
 * KPIs sourced from GET /contratos/dashboard:
 *   - total contratos
 *   - por estado
 *   - expira em 30 / 90 dias
 *   - janela de denúncia em 60 dias
 *   - actos regulatórios pendentes
 */

import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { ContratoEstado, CONTRATO_ESTADO_LABELS } from '@kamaia/shared-types'
import { FileText, Clock, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react'

interface DashboardKpis {
  totalContratos: number
  porEstado: Partial<Record<ContratoEstado, number>>
  expiramEm30Dias: number
  expiramEm90Dias: number
  denunciaEm60Dias: number
  actosPendentes: number
}

export default function DashboardPage() {
  const { data, loading, error } = useApi<DashboardKpis>('/contratos/dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200 }}>
      <header>
        <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ marginTop: 6, color: 'var(--k2-text-dim)', fontSize: 14 }}>
          Visão executiva da carteira de contratos.
        </p>
      </header>

      {error && (
        <div
          style={{
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            padding: '10px 14px',
            borderRadius: 'var(--k2-radius)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KpiCard
          icon={FileText}
          label="Total de contratos"
          value={data?.totalContratos ?? 0}
          loading={loading}
          href="/contratos"
        />
        <KpiCard
          icon={Clock}
          label="Expiram em 30 dias"
          value={data?.expiramEm30Dias ?? 0}
          loading={loading}
          href="/contratos?expiraEmDias=30"
          tone="warning"
        />
        <KpiCard
          icon={Clock}
          label="Expiram em 90 dias"
          value={data?.expiramEm90Dias ?? 0}
          loading={loading}
          href="/contratos?expiraEmDias=90"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Janela de denúncia ≤ 60 dias"
          value={data?.denunciaEm60Dias ?? 0}
          loading={loading}
          href="/contratos?denunciaEmDias=60"
          tone="warning"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Actos pendentes"
          value={data?.actosPendentes ?? 0}
          loading={loading}
          href="/compliance"
          tone="danger"
        />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--k2-text-dim)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Por estado
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}
        >
          {Object.values(ContratoEstado).map((estado) => {
            const count = data?.porEstado?.[estado] ?? 0
            return (
              <Link
                key={estado}
                href={`/contratos?estado=${estado}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--k2-bg-elev)',
                  borderRadius: 'var(--k2-radius-sm)',
                  border: '1px solid var(--k2-border)',
                  textDecoration: 'none',
                  color: 'var(--k2-text)',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--k2-text-dim)' }}>
                  {CONTRATO_ESTADO_LABELS[estado]}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
  tone = 'default',
}: {
  icon: React.ElementType
  label: string
  value: number
  loading?: boolean
  href: string
  tone?: 'default' | 'warning' | 'danger'
}) {
  const toneColor =
    tone === 'danger' ? 'var(--k2-bad)' : tone === 'warning' ? 'var(--k2-warn)' : 'var(--k2-accent)'
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius)',
        textDecoration: 'none',
        color: 'var(--k2-text)',
        transition: 'border-color 120ms, transform 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--k2-bg-elev-2)',
            color: toneColor,
          }}
        >
          <Icon size={16} />
        </div>
        <ArrowRight size={14} style={{ color: 'var(--k2-text-mute)' }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--k2-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
          {loading ? '…' : value.toLocaleString('pt-AO')}
        </div>
      </div>
    </Link>
  )
}
