'use client'

/**
 * Kamaia CLM — Entidade detail page.
 * Shows core data, contactos, KYC, and contratos onde aparece.
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import {
  EntidadeTipo,
  EntidadeNacionalidadeCambial,
  ContratoEstado,
} from '@kamaia/shared-types'
import { estadoBadgeVariant, estadoLabel, fmtDate } from '@/lib/clm-format'
import { ChevronLeft } from 'lucide-react'

interface Entidade {
  id: string
  nome: string
  tipo: EntidadeTipo
  nacionalidadeCambial: EntidadeNacionalidadeCambial
  nif: string | null
  email: string | null
  telefone: string | null
  morada: string | null
  paisResidencia: string | null
}

interface Contacto {
  id: string
  nome: string
  cargo: string | null
  email: string | null
  telefone: string | null
}

interface Kyc {
  documentoIdentificacao: string | null
  validadeDocumento: string | null
  documentoBeneficiario: string | null
  verificadoEm: string | null
}

interface ContratoMin {
  id: string
  numero: string | null
  titulo: string
  estado: ContratoEstado
  papel: string
}

export default function EntidadeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: entidade, loading } = useApi<Entidade>(`/entidades/${id}`)
  const { data: contactos } = useApi<Contacto[]>(`/entidades/${id}/contactos`)
  const { data: kyc } = useApi<Kyc | null>(`/entidades/${id}/kyc`)
  const { data: contratos } = useApi<ContratoMin[]>(`/entidades/${id}/contratos`)

  if (loading) return <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/entidades" style={{ color: 'var(--k2-text-dim)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={12} /> Entidades
      </Link>

      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{entidade?.nome}</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Badge variant="default">{entidade?.tipo === EntidadeTipo.PESSOA_SINGULAR ? 'Singular' : 'Colectiva'}</Badge>
          <Badge variant={entidade?.nacionalidadeCambial === EntidadeNacionalidadeCambial.NAO_RESIDENTE ? 'warning' : 'default'}>
            {entidade?.nacionalidadeCambial === EntidadeNacionalidadeCambial.NAO_RESIDENTE ? 'Não-residente' : 'Residente'}
          </Badge>
        </div>
      </header>

      <Section title="Dados">
        <Grid>
          <Info label="NIF" value={entidade?.nif} />
          <Info label="Email" value={entidade?.email} />
          <Info label="Telefone" value={entidade?.telefone} />
          <Info label="País" value={entidade?.paisResidencia} />
          <Info label="Morada" value={entidade?.morada} />
        </Grid>
      </Section>

      <Section title="Contactos">
        {(contactos ?? []).length === 0 ? (
          <Muted>Sem contactos registados.</Muted>
        ) : (
          <Grid>
            {contactos!.map((c) => (
              <Info key={c.id} label={c.cargo ?? c.nome} value={[c.nome, c.email, c.telefone].filter(Boolean).join(' · ')} />
            ))}
          </Grid>
        )}
      </Section>

      <Section title="KYC">
        {!kyc ? <Muted>Sem informação KYC.</Muted> : (
          <Grid>
            <Info label="Documento de identificação" value={kyc.documentoIdentificacao} />
            <Info label="Validade do documento" value={fmtDate(kyc.validadeDocumento)} />
            <Info label="Beneficiário efectivo" value={kyc.documentoBeneficiario} />
            <Info label="Verificado em" value={fmtDate(kyc.verificadoEm)} />
          </Grid>
        )}
      </Section>

      <Section title="Contratos onde aparece">
        {(contratos ?? []).length === 0 ? (
          <Muted>Esta entidade não está em nenhum contrato.</Muted>
        ) : (
          <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
            {contratos!.map((c) => (
              <Link
                key={c.id}
                href={`/contratos/${c.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderTop: '1px solid var(--k2-border)',
                  textDecoration: 'none',
                  color: 'var(--k2-text)',
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{c.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{c.numero ?? '—'} · {c.papel.replaceAll('_', ' ')}</div>
                </div>
                <Badge variant={estadoBadgeVariant(c.estado)}>{estadoLabel(c.estado)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 11, fontWeight: 500, color: 'var(--k2-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>{children}</div>
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--k2-text)', marginTop: 4 }}>{value || '—'}</div>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--k2-text-mute)', fontSize: 13 }}>{children}</div>
}
