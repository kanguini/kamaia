'use client'

/**
 * Kamaia CLM — Templates library.
 */

import { useApi } from '@/hooks/use-api'
import type { PaginatedResponse } from '@kamaia/shared-types'
import { fmtDateTime } from '@/lib/clm-format'

interface Template {
  id: string
  nome: string
  descricao: string | null
  tipoContrato: { id: string; nome: string } | null
  atualizadoEm: string
  publicado: boolean
}

export default function TemplatesPage() {
  const { data, loading } = useApi<PaginatedResponse<Template>>('/templates?limit=100')
  const templates = data?.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Templates</h1>
        <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
          Modelos contratuais reutilizáveis da tua biblioteca.
        </p>
      </header>

      {loading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}
      {!loading && templates.length === 0 && (
        <div style={{ color: 'var(--k2-text-mute)' }}>Ainda não tens templates.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {templates.map((t) => (
          <div
            key={t.id}
            style={{
              padding: 14,
              background: 'var(--k2-bg-elev)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 500 }}>{t.nome}</div>
              {!t.publicado && (
                <span style={{ fontSize: 10, color: 'var(--k2-warn)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rascunho</span>
              )}
            </div>
            {t.tipoContrato && (
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 2 }}>{t.tipoContrato.nome}</div>
            )}
            {t.descricao && <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 8 }}>{t.descricao}</div>}
            <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 10 }}>Actualizado em {fmtDateTime(t.atualizadoEm)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
