'use client'

/**
 * PdfPreviewDrawer — preview do PDF do contrato in-browser.
 *
 * Endpoint /contratos/:id/pdf devolve `application/pdf` em streaming
 * mas com auth headers (Bearer + X-Tenant-Id). Para mostrar inline:
 *  1. fetch como blob
 *  2. URL.createObjectURL → blob: URL local
 *  3. <iframe src=blobUrl> dentro do drawer
 *  4. revokeObjectURL no unmount/close para libertar memória
 *
 * Fallback: se browser bloquear iframes blob, o link "Abrir em nova
 * aba" usa o mesmo blobUrl com noopener.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import { apiUrl, getActiveTenantId } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'

export function PdfPreviewDrawer({
  open,
  onClose,
  contratoId,
  fileName,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  fileName?: string
}) {
  const { data: session } = useSession()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    if (!session?.accessToken) return
    setLoading(true)
    setErr(null)
    try {
      const tenantId = getActiveTenantId()
      const res = await fetch(apiUrl(`/contratos/${contratoId}/pdf`), {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
        },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const blob = await res.blob()
      // Liberta URL antiga antes de gerar nova
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
    } catch (e) {
      setErr((e as Error).message || 'Erro a gerar PDF')
    } finally {
      setLoading(false)
    }
  }

  // Carrega ao abrir
  useEffect(() => {
    if (!open) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contratoId, session?.accessToken])

  // Cleanup
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const download = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName ?? `contrato-${contratoId.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Drawer open={open} onClose={onClose} width={920}>
      <DrawerHeader
        title="Preview PDF"
        subtitle="Regenerado on-demand — reflecte o corpo + assinaturas até este momento."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}
        {loading && (
          <div style={{ padding: 24, color: 'var(--k2-text-mute)', textAlign: 'center' }}>
            A gerar PDF…
          </div>
        )}
        {blobUrl && !loading && (
          <iframe
            src={blobUrl}
            title="Preview do contrato em PDF"
            style={{
              width: '100%',
              height: '78vh',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius-sm)',
              background: 'white',
            }}
          />
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button
          variant="secondary"
          type="button"
          onClick={() => void load()}
          leftIcon={<RefreshCw size={13} />}
          loading={loading}
        >
          Regenerar
        </Button>
        <div style={{ flex: 1 }} />
        {blobUrl && (
          <>
            <a
              href={blobUrl}
              target="_blank"
              rel="noopener"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                border: '1px solid var(--k2-border)',
                borderRadius: 'var(--k2-radius-sm)',
                color: 'var(--k2-text-dim)',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} /> Nova aba
            </a>
            <Button onClick={download} leftIcon={<Download size={13} />}>
              Descarregar
            </Button>
          </>
        )}
      </DrawerFooter>
    </Drawer>
  )
}
