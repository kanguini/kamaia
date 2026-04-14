'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  Scale, Clock, FileText, AlertTriangle, CheckCircle,
  ChevronRight, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, isOverdue } from '@/lib/date-utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface PortalData {
  cliente: { id: string; name: string; type: string; email: string; phone: string }
  processos: Array<{
    id: string; processoNumber: string; title: string; type: string
    status: string; stage: string; court: string; updatedAt: string
  }>
  prazos: Array<{
    id: string; title: string; type: string; status: string; dueDate: string
    processo: { title: string; processoNumber: string }
  }>
  documents: Array<{ id: string; title: string; category: string; createdAt: string }>
  stats: { totalProcessos: number; activeProcessos: number; pendingPrazos: number; totalDocuments: number }
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  SUSPENSO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ENCERRADO: 'bg-surface-raised text-ink-muted',
  PENDENTE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CUMPRIDO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  EXPIRADO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function PortalContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProcesso, setSelectedProcesso] = useState<string | null>(null)
  const [processoDetail, setProcessoDetail] = useState<any>(null)

  useEffect(() => {
    if (!token) { setError('Link de acesso invalido'); setLoading(false); return }
    fetch(`${API_URL}/portal/overview?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => { if (json.error) setError(json.error); else setData(json.data) })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [token])

  const loadProcesso = async (processoId: string) => {
    setSelectedProcesso(processoId)
    try {
      const res = await fetch(`${API_URL}/portal/processo/${processoId}?token=${encodeURIComponent(token!)}`)
      const json = await res.json()
      if (json.data) setProcessoDetail(json.data)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-border border-t-ink rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted">A carregar...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-ink-muted mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-ink mb-2">Acesso Negado</h1>
          <p className="text-ink-muted">{error}</p>
          <p className="text-sm text-ink-muted mt-4">Contacte o seu advogado para obter um novo link de acesso.</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface-raised border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-ink">KAMAIA</h1>
            <p className="text-sm text-ink-muted">Portal do Cliente</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-ink">{data.cliente.name}</p>
            <p className="text-sm text-ink-muted">{data.cliente.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Processos', value: data.stats.totalProcessos, icon: Scale },
            { label: 'Activos', value: data.stats.activeProcessos, icon: CheckCircle },
            { label: 'Prazos Pendentes', value: data.stats.pendingPrazos, icon: Clock },
            { label: 'Documentos', value: data.stats.totalDocuments, icon: FileText },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface-raised rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-ink-muted" />
                <span className="text-xs text-ink-muted uppercase">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Processos */}
        <section>
          <h2 className="text-lg font-semibold text-ink mb-4">Meus Processos</h2>
          {data.processos.length === 0 ? (
            <div className="bg-surface-raised rounded-lg border border-border p-8 text-center text-ink-muted">Sem processos associados.</div>
          ) : (
            <div className="space-y-3">
              {data.processos.map((processo) => (
                <div key={processo.id}>
                  <button
                    onClick={() => selectedProcesso === processo.id ? setSelectedProcesso(null) : loadProcesso(processo.id)}
                    className="w-full bg-surface-raised rounded-lg border border-border p-4 hover:border-ink/20 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Scale className="w-5 h-5 text-ink-muted" />
                        <div>
                          <p className="font-medium text-ink">{processo.title}</p>
                          <p className="text-sm text-ink-muted">{processo.processoNumber} &middot; {processo.type} &middot; {processo.court || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-1 text-xs font-medium rounded', STATUS_STYLES[processo.status] || 'bg-surface-raised text-ink-muted')}>
                          {processo.status}
                        </span>
                        <span className="text-xs text-ink-muted">{processo.stage}</span>
                        <ChevronRight className={cn('w-4 h-4 text-ink-muted transition-transform', selectedProcesso === processo.id && 'rotate-90')} />
                      </div>
                    </div>
                  </button>

                  {selectedProcesso === processo.id && processoDetail && (
                    <div className="ml-8 mt-2 bg-surface-raised rounded-lg border border-border p-4 space-y-4">
                      {processoDetail.prazos?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-ink mb-2">Prazos</h4>
                          <div className="space-y-2">
                            {processoDetail.prazos.map((p: any) => (
                              <div key={p.id} className="flex items-center justify-between text-sm">
                                <span className="text-ink">{p.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className={cn('px-2 py-0.5 text-xs rounded', STATUS_STYLES[p.status])}>{p.status}</span>
                                  <span className="text-ink-muted">{formatDate(p.dueDate)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {processoDetail.events?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-ink mb-2">Ultimas Actualizacoes</h4>
                          <div className="space-y-2">
                            {processoDetail.events.map((e: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-ink-muted text-xs mt-0.5">{formatDate(e.createdAt)}</span>
                                <span className="text-ink">{e.description || e.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {processoDetail.documents?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-ink mb-2">Documentos</h4>
                          <div className="space-y-1">
                            {processoDetail.documents.map((d: any) => (
                              <div key={d.id} className="flex items-center gap-2 text-sm text-ink">
                                <FileText className="w-3 h-3 text-ink-muted" />
                                <span>{d.title}</span>
                                <span className="text-ink-muted text-xs">({d.category})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending Prazos */}
        {data.prazos.filter((p) => p.status === 'PENDENTE').length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Prazos Pendentes
            </h2>
            <div className="bg-surface-raised rounded-lg border border-border divide-y divide-border">
              {data.prazos.filter((p) => p.status === 'PENDENTE').map((prazo) => (
                <div key={prazo.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink">{prazo.title}</p>
                    <p className="text-sm text-ink-muted">{prazo.processo.processoNumber} &middot; {prazo.type}</p>
                  </div>
                  <span className={cn('text-sm font-medium', isOverdue(prazo.dueDate) ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                    {formatDate(prazo.dueDate)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-surface-raised px-6 py-4 mt-12">
        <div className="max-w-5xl mx-auto text-center text-sm text-ink-muted">
          Kamaia &copy; {new Date().getFullYear()} — Portal do Cliente
        </div>
      </footer>
    </div>
  )
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-border border-t-ink rounded-full animate-spin" />
      </div>
    }>
      <PortalContent />
    </Suspense>
  )
}
