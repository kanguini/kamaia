'use client'

/**
 * Tab Assinaturas — visualização interna das assinaturas recebidas
 * num contrato + acção de descarregar o PDF completo (contrato +
 * folha de assinaturas).
 *
 * O endpoint internacional `/contratos/:id/assinaturas` não devolve
 * a `imagemBase64` (pesada); para ver a imagem o utilizador abre o
 * PDF. Quando precisar de inspecção mais fina vai-se buscar a imagem
 * via GET `/:id/assinaturas/:assinaturaId` (já existe).
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Download, FileSignature, ShieldCheck } from 'lucide-react'
import { api, apiUrl, getActiveTenantId } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtDateTime } from '@/lib/clm-format'

interface Assinatura {
  id: string
  signatarioNome: string
  signatarioEmail: string | null
  signatarioBI: string | null
  cargo: string | null
  metodo: string
  estado: string
  hashContratoSnapshot: string
  ipAddress: string | null
  geoCidade: string | null
  geoPais: string | null
  solicitadaEm: string
  assinadaEm: string | null
  versaoId: string | null
}

export function AssinaturasTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<Assinatura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    api<Assinatura[]>(`/contratos/${contratoId}/assinaturas`, {
      token: session.accessToken,
    })
      .then((data) => {
        if (!cancelled) setItems(data ?? [])
      })
      .catch((e: { error?: string }) => {
        if (!cancelled) setError(e?.error ?? 'Erro a carregar assinaturas')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [contratoId, session?.accessToken, status])

  const downloadPdf = async () => {
    if (!session?.accessToken) return
    setDownloading(true)
    try {
      // Endpoint devolve stream binário com PDF; fetch directo (não api())
      // porque api() faz res.json() — não serve para binário.
      const tenantId = getActiveTenantId()
      const res = await fetch(apiUrl(`/contratos/${contratoId}/pdf`), {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contrato-${contratoId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert((e as Error).message || 'Erro a gerar PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>
          {items.length} assinatura(s) registada(s) ao abrigo da Lei n.º 1/11.
          O PDF inclui o corpo do contrato + folha de assinaturas com
          hash criptográfico de integridade.
        </div>
        <Button
          variant="secondary"
          onClick={downloadPdf}
          loading={downloading}
          leftIcon={<Download size={13} />}
        >
          Descarregar PDF
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
          <div style={{ padding: 20, color: 'var(--k2-text-mute)' }}>A carregar…</div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <FileSignature size={26} color="var(--k2-text-mute)" />
            <div style={{ fontSize: 14 }}>Sem assinaturas ainda</div>
            <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', maxWidth: 360 }}>
              Convida colaboradores na tab Partilha com nível de acesso
              “Pode assinar” para começar a recolher assinaturas.
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map((a) => (
              <li
                key={a.id}
                style={{
                  borderTop: '1px solid var(--k2-border)',
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500 }}>{a.signatarioNome}</span>
                    {a.cargo && (
                      <span style={{ color: 'var(--k2-text-dim)', fontSize: 12 }}>· {a.cargo}</span>
                    )}
                    <Badge variant={a.estado === 'ASSINADA' ? 'success' : 'pendente'}>
                      {a.estado.toLowerCase()}
                    </Badge>
                    <Badge variant="info">{a.metodo.replaceAll('_', ' ').toLowerCase()}</Badge>
                  </div>
                  {a.signatarioEmail && (
                    <span style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>{a.signatarioEmail}</span>
                  )}
                  {a.signatarioBI && (
                    <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>BI/Passaporte: {a.signatarioBI}</span>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={11} />
                    Hash: <code style={{ fontFamily: 'var(--k2-font-mono, monospace)' }}>{a.hashContratoSnapshot.slice(0, 24)}…</code>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--k2-text-dim)' }}>
                  <div>{a.assinadaEm ? fmtDateTime(a.assinadaEm) : 'Pendente'}</div>
                  {a.ipAddress && (
                    <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>IP {a.ipAddress}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
