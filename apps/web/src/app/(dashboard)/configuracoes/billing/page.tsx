'use client'

/**
 * /configuracoes/billing — plano actual + uso + saldo de credits.
 *
 * Sprint 4.2: foco em READING. Mostra o plano actual, as 5 quotas
 * com barras de uso, e os outros planos disponíveis. Mutações
 * (mudar plano, top-up de credits) ficam para integração com
 * gateway de pagamento.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import {
  Sparkles,
  Users,
  FileText,
  HardDrive,
  MessageSquare,
  Check,
  TrendingUp,
} from 'lucide-react'

interface BillingStatus {
  plan: string
  planConfig: {
    plan: string
    label: string
    slug: string
    precoMensalCentavos: number
    tagline: string
    highlights: string[]
  }
  subscription: {
    status: string | null
    trialEndsAt: string | null
    currentPeriodEnd: string | null
    cancelled: boolean
  }
  usage: {
    contratos: { usado: number; limite: number; pct: number }
    utilizadores: { usado: number; limite: number; pct: number }
    storage: { usadoBytes: string; limiteGB: number; pct: number }
    iaMessages: { usado: number; limite: number; pct: number }
    aiCredits: { usado: number; limite: number; pct: number }
    periodoInicio: string
    periodoFim: string
  }
}

interface Plan {
  plan: string
  label: string
  slug: string
  precoMensalCentavos: number
  tagline: string
  highlights: string[]
  quotas: {
    contratosLimit: number
    utilizadoresLimit: number
    storageGBLimit: number
    iaMessagesLimit: number
    aiCreditsLimit: number
  }
  isPublic: boolean
}

function fmtAkz(centavos: number): string {
  if (centavos === 0) return 'Sob proposta'
  const akz = centavos / 100
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'AOA',
    maximumFractionDigits: 0,
  })
    .format(akz)
    .replace('AOA', 'AKZ')
}

function fmtBytes(bytes: string | number, max = 2): string {
  let n = typeof bytes === 'string' ? Number(bytes) : bytes
  if (!Number.isFinite(n)) n = 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(max)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(max)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(max)} GB`
}

/**
 * Onda C.1.4: distinguir limite real de unlimited (sentinel -1).
 * "120 / -1" não diz nada ao utilizador; "120 / ∞" é claro.
 */
function fmtQuota(usado: number, limite: number): string {
  if (limite < 0) return `${usado} / ∞`
  return `${usado} / ${limite}`
}

export default function BillingPage() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return
    Promise.all([
      api<BillingStatus>('/billing/status', { token: session.accessToken }),
      api<{ data: Plan[] }>('/billing/plans'),
    ])
      .then(([s, p]) => {
        setStatus(s)
        setPlans(p.data ?? [])
      })
      .catch((e: { error?: string }) =>
        setErr(e?.error ?? 'Erro ao carregar billing'),
      )
  }, [session?.accessToken])

  if (err) {
    return <div style={{ color: 'var(--k2-bad)', fontSize: 13 }}>{err}</div>
  }

  if (!status) {
    return (
      <div style={{ color: 'var(--k2-text-mute)', fontSize: 13 }}>
        A carregar…
      </div>
    )
  }

  return (
    <div className="bp">
      {/* Hero do plano actual */}
      <section className="bp-current">
        <div className="bp-current-head">
          <div>
            <div className="bp-current-label">Plano actual</div>
            <h2 className="bp-current-name">{status.planConfig.label}</h2>
            <div className="bp-current-tag">{status.planConfig.tagline}</div>
          </div>
          <div className="bp-current-price">
            <div className="bp-current-amount">
              {fmtAkz(status.planConfig.precoMensalCentavos)}
            </div>
            {status.planConfig.precoMensalCentavos > 0 && (
              <div className="bp-current-period">/ mês</div>
            )}
          </div>
        </div>
        {status.subscription.currentPeriodEnd && (
          <div className="bp-current-period-info">
            Próximo ciclo: {fmtDate(status.subscription.currentPeriodEnd)}
            {status.subscription.cancelled && (
              <span className="bp-cancelled"> · subscription cancelada</span>
            )}
          </div>
        )}
      </section>

      {/* Uso */}
      <section className="bp-section">
        <h3 className="bp-h3">Uso no período actual</h3>
        <div className="bp-period">
          {fmtDate(status.usage.periodoInicio)} →{' '}
          {fmtDate(status.usage.periodoFim)}
        </div>
        <div className="bp-usage-grid">
          <UsageCard
            icon={FileText}
            label="Contratos activos"
            value={fmtQuota(status.usage.contratos.usado, status.usage.contratos.limite)}
            pct={status.usage.contratos.pct}
            unlimited={status.usage.contratos.limite < 0}
          />
          <UsageCard
            icon={Users}
            label="Utilizadores"
            value={fmtQuota(status.usage.utilizadores.usado, status.usage.utilizadores.limite)}
            pct={status.usage.utilizadores.pct}
            unlimited={status.usage.utilizadores.limite < 0}
          />
          <UsageCard
            icon={HardDrive}
            label="Armazenamento"
            value={
              status.usage.storage.limiteGB < 0
                ? `${fmtBytes(status.usage.storage.usadoBytes)} / ∞`
                : `${fmtBytes(status.usage.storage.usadoBytes)} / ${status.usage.storage.limiteGB} GB`
            }
            pct={status.usage.storage.pct}
            unlimited={status.usage.storage.limiteGB < 0}
          />
          <UsageCard
            icon={MessageSquare}
            label="Mensagens Kamaia AI"
            value={fmtQuota(status.usage.iaMessages.usado, status.usage.iaMessages.limite)}
            pct={status.usage.iaMessages.pct}
            unlimited={status.usage.iaMessages.limite < 0}
          />
          <UsageCard
            icon={Sparkles}
            label="Créditos IA"
            value={fmtQuota(status.usage.aiCredits.usado, status.usage.aiCredits.limite)}
            pct={status.usage.aiCredits.pct}
            unlimited={status.usage.aiCredits.limite < 0}
            hint="Para operações de alto custo (parsing batch, drafting completo)."
          />
        </div>
      </section>

      {/* Planos */}
      {plans.length > 0 && (
        <section className="bp-section">
          <h3 className="bp-h3">Comparar planos</h3>
          <div className="bp-plans">
            {plans.map((p) => {
              const isCurrent = p.plan === status.plan
              return (
                <div
                  key={p.plan}
                  className={`bp-plan ${isCurrent ? 'current' : ''}`}
                >
                  <div className="bp-plan-head">
                    <div className="bp-plan-name">{p.label}</div>
                    {isCurrent && <span className="bp-plan-tag">actual</span>}
                  </div>
                  <div className="bp-plan-price">
                    {fmtAkz(p.precoMensalCentavos)}
                  </div>
                  <div className="bp-plan-tagline">{p.tagline}</div>
                  <ul className="bp-plan-highlights">
                    {p.highlights.map((h, i) => (
                      <li key={i}>
                        <Check size={11} /> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <div className="bp-plans-foot">
            <TrendingUp size={11} />
            Para mudar de plano, contacta o suporte. Integração com gateway
            de pagamento em breve.
          </div>
        </section>
      )}

      <style jsx>{`
        .bp {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .bp-current {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          padding: 20px;
        }
        .bp-current-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .bp-current-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--k2-text-mute);
          font-weight: 600;
        }
        .bp-current-name {
          margin: 4px 0 4px;
          font-size: 22px;
          font-weight: 500;
          color: var(--k2-text);
        }
        .bp-current-tag {
          font-size: 12px;
          color: var(--k2-text-mute);
        }
        .bp-current-price {
          text-align: right;
        }
        .bp-current-amount {
          font-size: 22px;
          font-weight: 600;
          color: var(--k2-text);
          font-variant-numeric: tabular-nums;
        }
        .bp-current-period {
          font-size: 11px;
          color: var(--k2-text-mute);
        }
        .bp-current-period-info {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--k2-border);
          font-size: 11px;
          color: var(--k2-text-mute);
        }
        .bp-cancelled {
          color: var(--k2-warn);
        }
        .bp-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .bp-h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .bp-period {
          font-size: 11px;
          color: var(--k2-text-mute);
        }
        .bp-usage-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .bp-plans {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .bp-plan {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .bp-plan.current {
          border-color: var(--k2-text);
          box-shadow: 0 0 0 1px var(--k2-text) inset;
        }
        .bp-plan-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .bp-plan-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .bp-plan-tag {
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 2px 6px;
          background: var(--k2-text);
          color: var(--k2-accent-fg);
          border-radius: 999px;
          font-weight: 600;
        }
        .bp-plan-price {
          font-size: 16px;
          font-weight: 600;
          color: var(--k2-text);
          font-variant-numeric: tabular-nums;
        }
        .bp-plan-tagline {
          font-size: 11px;
          color: var(--k2-text-mute);
          line-height: 1.4;
        }
        .bp-plan-highlights {
          margin: 8px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .bp-plan-highlights li {
          display: flex;
          align-items: flex-start;
          gap: 5px;
          font-size: 11px;
          color: var(--k2-text-dim);
          line-height: 1.5;
        }
        .bp-plan-highlights :global(svg) {
          color: var(--k2-text-mute);
          margin-top: 3px;
          flex-shrink: 0;
        }
        .bp-plans-foot {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-top: 4px;
        }
      `}</style>
    </div>
  )
}

function UsageCard({
  icon: Icon,
  label,
  value,
  pct,
  hint,
  unlimited = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  pct: number
  hint?: string
  unlimited?: boolean
}) {
  const high = !unlimited && pct >= 80
  const crit = !unlimited && pct >= 95
  return (
    <div className="uc">
      <div className="uc-head">
        <Icon size={13} className="uc-icon" />
        <div className="uc-label">{label}</div>
      </div>
      <div className="uc-value">{value}</div>
      {/* Onda C.1.4: barra de progresso esconde-se em planos unlimited
          (não faz sentido mostrar "0% de ∞"). */}
      {!unlimited && (
        <>
          <div className="uc-bar-wrap">
            <div
              className={`uc-bar ${high ? 'high' : ''} ${crit ? 'crit' : ''}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="uc-pct">{pct}%</div>
        </>
      )}
      {unlimited && <div className="uc-pct">Sem limite</div>}
      {hint && <div className="uc-hint">{hint}</div>}
      <style jsx>{`
        .uc {
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .uc-head {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .uc-icon {
          color: var(--k2-text-mute);
        }
        .uc-label {
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--k2-text-mute);
          font-weight: 600;
        }
        .uc-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--k2-text);
          font-variant-numeric: tabular-nums;
        }
        .uc-bar-wrap {
          width: 100%;
          height: 4px;
          background: var(--k2-bg);
          border-radius: 999px;
          overflow: hidden;
        }
        .uc-bar {
          height: 100%;
          background: var(--k2-text);
          border-radius: 999px;
          transition: width 200ms ease;
        }
        .uc-bar.high {
          background: var(--k2-warn);
        }
        .uc-bar.crit {
          background: var(--k2-bad);
        }
        .uc-pct {
          font-size: 10px;
          color: var(--k2-text-mute);
          text-align: right;
        }
        .uc-hint {
          font-size: 10px;
          color: var(--k2-text-mute);
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}

function fmtDate(iso: string): string {
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
