'use client'

/**
 * Kamaia CLM — Backup & Restore.
 *
 * Apenas ADMIN. UI tem dois cartões:
 *  - **Exportar**: descarrega dump JSON do tenant + lista histórico
 *  - **Restaurar**: upload do JSON → dry-run mostra manifest →
 *    confirmação humana → escrita real
 *
 * Política deliberada: o restore **sempre** começa em dry-run. Só
 * depois de o utilizador inspeccionar o manifest é que pode optar
 * por escrever. Em colisão de IDs, default `skip` (mantém row
 * existente) — `error` aborta tudo.
 */

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, apiUrl, getActiveTenantId } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Download, Upload, AlertTriangle, CheckCircle2, FileJson, RefreshCw } from 'lucide-react'
import { fmtDateTime } from '@/lib/clm-format'

interface BackupExport {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  createdAt: string
  completedAt: string | null
  sizeBytes: number | null
  manifest: Record<string, number> | null
  errorMessage: string | null
  type?: string
}

interface ListResponse {
  data: BackupExport[]
}

interface RestoreManifest {
  collections: Record<
    string,
    { inBackup: number; toCreate: number; collisions: number; skipped: number }
  >
  collisionIds: { collection: string; id: string }[]
  totalWritten: number
  backupVersion: string
  sourceTenantId: string | null
  targetTenantId: string
}

interface RestoreResponse {
  summary: BackupExport
  manifest: RestoreManifest
}

export default function BackupPage() {
  const { data: session, status } = useSession()
  const [history, setHistory] = useState<BackupExport[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Restore state
  const fileInput = useRef<HTMLInputElement>(null)
  const [backupJson, setBackupJson] = useState<unknown | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [collisionPolicy, setCollisionPolicy] = useState<'skip' | 'error'>('skip')
  const [dryRunResult, setDryRunResult] = useState<RestoreManifest | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [committedResult, setCommittedResult] = useState<RestoreManifest | null>(null)

  const loadHistory = async () => {
    if (!session?.accessToken) return
    setLoading(true)
    try {
      const res = await api<ListResponse>('/backup/exports', {
        token: session.accessToken,
      })
      setHistory(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.accessToken])

  const handleExport = async () => {
    if (!session?.accessToken) return
    setExporting(true)
    try {
      const tenantId = getActiveTenantId()
      const res = await fetch(apiUrl('/backup/export'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const m = /filename="?([^";]+)"?/.exec(disposition)
      const name = m?.[1] ?? `kamaia-backup-${Date.now()}.json`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      await loadHistory()
    } catch (e) {
      alert(`Erro ao exportar: ${(e as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setDryRunResult(null)
    setCommittedResult(null)
    setRestoreError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setBackupJson(parsed)
    } catch (err) {
      setBackupJson(null)
      setRestoreError(`Ficheiro não é JSON válido: ${(err as Error).message}`)
    }
  }

  const runRestore = async (dryRun: boolean) => {
    if (!backupJson || !session?.accessToken) return
    setRestoring(true)
    setRestoreError(null)
    try {
      const res = await api<RestoreResponse>('/backup/restore', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          dryRun,
          collisionPolicy,
          backup: backupJson,
        }),
      })
      if (dryRun) {
        setDryRunResult(res.manifest)
        setCommittedResult(null)
      } else {
        setCommittedResult(res.manifest)
        setDryRunResult(null)
        await loadHistory()
      }
    } catch (e) {
      setRestoreError((e as Error).message)
    } finally {
      setRestoring(false)
    }
  }

  const resetRestore = () => {
    setBackupJson(null)
    setFileName(null)
    setDryRunResult(null)
    setCommittedResult(null)
    setRestoreError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Export card */}
      <section style={card}>
        <div style={cardHeader}>
          <Download size={16} />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Exportar backup</h2>
        </div>
        <p style={muted}>
          Gera um dump JSON com toda a operação deste tenant — entidades, contratos,
          versões, eventos, documentos (metadata). Tamanho do payload pode ser grande;
          o ficheiro é descarregado em memória.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleExport} loading={exporting} leftIcon={<Download size={14} />}>
            Exportar agora
          </Button>
          <Button variant="ghost" onClick={loadHistory} leftIcon={<RefreshCw size={14} />}>
            Actualizar histórico
          </Button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={tableHeader}>
            <span>Quando</span>
            <span>Tipo</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Tamanho</span>
          </div>
          {history.length === 0 && (
            <div style={{ ...muted, padding: '14px 0' }}>
              {loading ? 'A carregar histórico…' : 'Sem backups ainda.'}
            </div>
          )}
          {history.map((h) => (
            <div key={h.id} style={tableRow}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtDateTime(h.createdAt)}
              </span>
              <span style={badge}>{h.type ?? 'export'}</span>
              <span style={statusBadge(h.status)}>{h.status}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {h.sizeBytes ? `${(h.sizeBytes / 1024).toFixed(1)} KB` : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Restore card */}
      <section style={card}>
        <div style={cardHeader}>
          <Upload size={16} />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Restaurar backup</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--k2-radius-sm)' }}>
          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--k2-text)', lineHeight: 1.5 }}>
            O restore é <strong>aditivo</strong>: rows com IDs já existentes no tenant
            actual são saltados (política <code>skip</code>) ou abortam tudo (política
            <code> error</code>). Memberships e logs de auditoria não são restaurados.
            Faz sempre dry-run primeiro.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <Button
            variant="ghost"
            leftIcon={<FileJson size={14} />}
            onClick={() => fileInput.current?.click()}
          >
            {fileName ? 'Trocar ficheiro' : 'Escolher ficheiro JSON'}
          </Button>
          {fileName && (
            <span style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>{fileName}</span>
          )}
        </div>

        {backupJson != null && (
          <>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>
                Política de colisão:
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input
                  type="radio"
                  name="policy"
                  value="skip"
                  checked={collisionPolicy === 'skip'}
                  onChange={() => setCollisionPolicy('skip')}
                />
                Saltar (skip)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input
                  type="radio"
                  name="policy"
                  value="error"
                  checked={collisionPolicy === 'error'}
                  onChange={() => setCollisionPolicy('error')}
                />
                Abortar em colisão (error)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => runRestore(true)}
                loading={restoring && !dryRunResult}
                leftIcon={<CheckCircle2 size={14} />}
              >
                Simular (dry-run)
              </Button>
              {dryRunResult && dryRunResult.totalWritten === 0 && (
                <div style={muted}>
                  Manifest pronto. Reveja antes de confirmar escrita.
                </div>
              )}
            </div>
          </>
        )}

        {restoreError && (
          <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--k2-radius-sm)', fontSize: 12, color: '#fca5a5' }}>
            ⚠ {restoreError}
          </div>
        )}

        {dryRunResult && <ManifestTable manifest={dryRunResult} />}

        {dryRunResult && (
          <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--k2-bg)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)' }}>
            <Button
              onClick={() => runRestore(false)}
              loading={restoring}
              leftIcon={<Upload size={14} />}
            >
              Confirmar e escrever
            </Button>
            <Button variant="ghost" onClick={resetRestore}>
              Cancelar
            </Button>
          </div>
        )}

        {committedResult && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
              <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
              <span>
                Restore concluído: <strong>{committedResult.totalWritten}</strong> rows
                escritas em <strong>{Object.keys(committedResult.collections).length}</strong>{' '}
                colecções.
              </span>
            </div>
            <ManifestTable manifest={committedResult} />
            <Button variant="ghost" onClick={resetRestore}>
              Fechar
            </Button>
          </>
        )}
      </section>
    </div>
  )
}

function ManifestTable({ manifest }: { manifest: RestoreManifest }) {
  const rows = Object.entries(manifest.collections)
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        Manifest do restore
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 4, fontSize: 12 }}>
        <span style={th}>Colecção</span>
        <span style={{ ...th, textAlign: 'right' }}>No backup</span>
        <span style={{ ...th, textAlign: 'right' }}>A criar</span>
        <span style={{ ...th, textAlign: 'right' }}>Colisões</span>
        <span style={{ ...th, textAlign: 'right' }}>Saltadas</span>
        {rows.map(([k, v]) => (
          <RowFrag key={k} k={k} v={v} />
        ))}
      </div>
    </div>
  )
}

function RowFrag({
  k,
  v,
}: {
  k: string
  v: { inBackup: number; toCreate: number; collisions: number; skipped: number }
}) {
  return (
    <>
      <span style={td}>{k}</span>
      <span style={{ ...td, textAlign: 'right' }}>{v.inBackup}</span>
      <span style={{ ...td, textAlign: 'right', color: v.toCreate > 0 ? 'var(--k2-accent)' : 'var(--k2-text-dim)' }}>{v.toCreate}</span>
      <span style={{ ...td, textAlign: 'right', color: v.collisions > 0 ? '#f59e0b' : 'var(--k2-text-dim)' }}>{v.collisions}</span>
      <span style={{ ...td, textAlign: 'right', color: 'var(--k2-text-dim)' }}>{v.skipped}</span>
    </>
  )
}

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 20,
  background: 'var(--k2-bg-elev)',
  border: '1px solid var(--k2-border)',
  borderRadius: 'var(--k2-radius)',
}

const cardHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--k2-text)',
}

const muted: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--k2-text-dim)',
  lineHeight: 1.6,
  margin: 0,
}

const tableHeader: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1fr',
  padding: '8px 4px',
  borderBottom: '1px solid var(--k2-border)',
  fontSize: 11,
  color: 'var(--k2-text-mute)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const tableRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1fr',
  padding: '10px 4px',
  borderBottom: '1px solid var(--k2-border)',
  fontSize: 13,
  alignItems: 'center',
  color: 'var(--k2-text)',
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  background: 'var(--k2-bg-elev-2)',
  borderRadius: 4,
  fontSize: 11,
  color: 'var(--k2-text-dim)',
  width: 'fit-content',
  textTransform: 'lowercase',
}

function statusBadge(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    done: { bg: 'rgba(34, 197, 94, 0.12)', fg: '#22c55e' },
    running: { bg: 'rgba(59, 130, 246, 0.12)', fg: '#3b82f6' },
    failed: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#ef4444' },
    queued: { bg: 'var(--k2-bg-elev-2)', fg: 'var(--k2-text-dim)' },
  }
  const c = colors[status] ?? colors.queued
  return {
    display: 'inline-block',
    padding: '2px 8px',
    background: c.bg,
    color: c.fg,
    borderRadius: 4,
    fontSize: 11,
    width: 'fit-content',
    textTransform: 'lowercase',
  }
}

const th: React.CSSProperties = {
  padding: '6px 8px',
  color: 'var(--k2-text-mute)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  borderBottom: '1px solid var(--k2-border)',
}

const td: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--k2-border)',
  color: 'var(--k2-text)',
  fontVariantNumeric: 'tabular-nums',
}
