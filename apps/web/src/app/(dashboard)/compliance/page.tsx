'use client'

/**
 * Kamaia CLM — Compliance Engine pendentes.
 *
 * Groups pending actos regulatórios por tipo (IS, Registos, BNA, AGT, Notário).
 */

import Link from 'next/link'
import { useApi, useMutation } from '@/hooks/use-api'
import {
  ActoRegulatorioTipo,
  ACTO_REGULATORIO_LABELS,
  ActoEstado,
} from '@kamaia/shared-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtDate, fmtMoney } from '@/lib/clm-format'

interface PendingActo {
  id: string
  contratoId: string
  contratoNumero: string | null
  contratoTitulo: string
  tipo: ActoRegulatorioTipo
  estado: ActoEstado
  referenciaLegal: string | null
  prazoLimite: string | null
  valorLiquidar: string | null
  detectadoAutomaticamente: boolean
}

const GRUPOS: Array<{ label: string; tipos: ActoRegulatorioTipo[] }> = [
  { label: 'Imposto de Selo', tipos: [ActoRegulatorioTipo.IMPOSTO_SELO] },
  { label: 'Registos', tipos: [
    ActoRegulatorioTipo.REGISTO_COMERCIAL,
    ActoRegulatorioTipo.REGISTO_PREDIAL,
    ActoRegulatorioTipo.REGISTO_AUTOMOVEL,
    ActoRegulatorioTipo.REGISTO_IP_IAPI,
  ] },
  { label: 'BNA', tipos: [ActoRegulatorioTipo.BNA_AUTORIZACAO, ActoRegulatorioTipo.BNA_REGISTO] },
  { label: 'AGT', tipos: [ActoRegulatorioTipo.AGT_RETENCAO_IRT, ActoRegulatorioTipo.AGT_OUTRO] },
  { label: 'Notário & Outros', tipos: [
    ActoRegulatorioTipo.RECONHECIMENTO_NOTARIAL,
    ActoRegulatorioTipo.TRADUCAO_JURAMENTADA,
    ActoRegulatorioTipo.SECTORIAL_OUTRO,
  ] },
]

export default function CompliancePage() {
  const { data, loading, refetch } = useApi<PendingActo[]>('/compliance/pendentes')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Compliance</h1>
        <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
          Actos regulatórios pendentes detectados pelo motor de compliance angolano.
        </p>
      </header>

      <div style={{ background: 'var(--k2-bg-elev-2)', borderRadius: 'var(--k2-radius-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--k2-text-dim)' }}>
        O motor <strong>sugere</strong>, nunca executa. Cada acto requer confirmação humana, e a lei vigente à data do facto tributário é a aplicável.
      </div>

      {loading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}

      {!loading && data && data.length === 0 && (
        <div style={{ color: 'var(--k2-text-mute)' }}>Sem actos pendentes — tudo em ordem.</div>
      )}

      {GRUPOS.map((g) => {
        const itens = (data ?? []).filter((a) => g.tipos.includes(a.tipo))
        if (itens.length === 0) return null
        return (
          <section key={g.label}>
            <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              {g.label} ({itens.length})
            </h2>
            <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
              {itens.map((a) => (
                <ActoRow key={a.id} acto={a} onChanged={refetch} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ActoRow({ acto, onChanged }: { acto: PendingActo; onChanged: () => void }) {
  const { mutate, loading } = useMutation(`/compliance/actos/${acto.id}/concluir`, 'POST')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderTop: '1px solid var(--k2-border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{ACTO_REGULATORIO_LABELS[acto.tipo]}</div>
        <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 2 }}>
          <Link href={`/contratos/${acto.contratoId}`} style={{ color: 'var(--k2-accent)', textDecoration: 'none' }}>
            {acto.contratoNumero ?? acto.contratoTitulo}
          </Link>
          {acto.referenciaLegal && <span> · {acto.referenciaLegal}</span>}
        </div>
      </div>
      {acto.prazoLimite && (
        <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>Prazo: {fmtDate(acto.prazoLimite)}</div>
      )}
      {acto.valorLiquidar && (
        <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>{fmtMoney(acto.valorLiquidar)}</div>
      )}
      <Badge variant={acto.estado === ActoEstado.PENDENTE ? 'warning' : 'info'}>{acto.estado.replaceAll('_', ' ')}</Badge>
      <Button
        size="sm"
        variant="secondary"
        loading={loading}
        onClick={async () => {
          await mutate({})
          onChanged()
        }}
      >
        Marcar concluído
      </Button>
    </div>
  )
}
