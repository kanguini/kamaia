'use client'

/**
 * Kamaia CLM — Templates library.
 */

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Download } from 'lucide-react'
import type { Role } from '@kamaia/shared-types'
import { useApi } from '@/hooks/use-api'
import { useTenants } from '@/hooks/use-tenants'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { fmtDateTime } from '@/lib/clm-format'
import { Button } from '@/components/ui/button'

interface Template {
  id: string
  nome: string
  descricao: string | null
  // O backend devolve `tipo` (não `tipoContrato`) e `updatedAt`.
  tipo: { id: string; codigo: string; nome: string } | null
  updatedAt: string
}

const GESTORES: Role[] = ['ADMIN', 'LEGAL_LEAD'] as Role[]

export default function TemplatesPage() {
  const { data: session } = useSession()
  const { tenants } = useTenants()
  const token = session?.accessToken

  const podeGerir = useMemo<boolean>(() => {
    if (typeof window === 'undefined') return false
    const id = window.localStorage.getItem('kamaia.activeTenantId')
    const role = tenants.find((x) => x.id === id)?.role ?? null
    return role !== null && GESTORES.includes(role)
  }, [tenants])

  // /templates devolve array directo (não pagina). Usa unwrap defensivo.
  const { data, loading, refetch } = useApi<unknown>('/templates')
  const templates = unwrapList<Template>(data)

  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const importarBase = async () => {
    if (!token) return
    setImporting(true)
    setMsg(null)
    try {
      const r = await api<{ criados: number; saltados: number; total: number }>(
        '/templates/importar-base',
        { method: 'POST', token },
      )
      setMsg(
        r.criados > 0
          ? `${r.criados} modelo(s) importado(s).`
          : 'Já tinhas todos os modelos base.',
      )
      refetch()
    } catch {
      setMsg('Não foi possível importar os modelos base.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Templates</h1>
        {podeGerir && (
          <Button
            variant="secondary"
            size="sm"
            onClick={importarBase}
            loading={importing}
            leftIcon={<Download size={13} />}
          >
            Importar modelos base
          </Button>
        )}
      </header>

      {msg && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--k2-text-dim)',
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
            padding: '10px 12px',
          }}
        >
          {msg}
        </div>
      )}

      {loading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}
      {!loading && templates.length === 0 && (
        <div
          style={{
            background: 'var(--k2-bg-elev)',
            border: '1px dashed var(--k2-border)',
            borderRadius: 'var(--k2-radius)',
            padding: '32px 24px',
            textAlign: 'center',
            color: 'var(--k2-text-mute)',
            fontSize: 13,
          }}
        >
          Ainda não tens templates.
          {podeGerir && ' Carrega em “Importar modelos base” para começar com modelos pt-AO prontos.'}
        </div>
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
            <div style={{ fontWeight: 500 }}>{t.nome}</div>
            {t.tipo && (
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 2 }}>{t.tipo.nome}</div>
            )}
            {t.descricao && <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 8 }}>{t.descricao}</div>}
            {t.updatedAt && (
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 10 }}>
                Actualizado em {fmtDateTime(t.updatedAt)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
