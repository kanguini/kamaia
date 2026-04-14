'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  Scale, Clock, FileText, AlertTriangle, CheckCircle,
  ChevronRight, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface PortalData {
  cliente: { id: string; name: string; type: string; email: string; phone: string }
  processos: Array<{
    id: string
    processoNumber: string
    title: string
    type: string
    status: string
    stage: string
    court: string
    updatedAt: string
  }>
  prazos: Array<{
    id: string
    title: string
    type: string
    status: string
    dueDate: string
    processo: { title: string; processoNumber: string }
  }>
  documents: Array<{
    id: string
    title: string
    category: string
    createdAt: string
  }>
  stats: {
    totalProcessos: number
    activeProcessos: number
    pendingPrazos: number
    totalDocuments: number
  }
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-800',
  SUSPENSO: 'bg-yellow-100 text-yellow-800',
  ENCERRADO: 'bg-gray-100 text-gray-600',
  PENDENTE: 'bg-blue-100 text-blue-800',
  CUMPRIDO: 'bg-green-100 text-green-800',
  EXPIRADO: 'bg-red-100 text-red-800',
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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
    if (!token) {
      setError('Link de acesso invalido')
      setLoading(false)
      return
    }

    fetch(`${API_URL}/portal/overview?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error)
        } else {
          setData(json.data)
        }
      })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [token])

  const loadProcesso = async (processoId: string) => {
    setSelectedProcesso(processoId)
    try {
      const res = await fetch(
        `${API_URL}/portal/processo/${processoId}?token=${encodeURIComponent(token!)}`,
      )
      const json = await res.json()
      if (json.data) setProcessoDetail(json.data)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">A carregar...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-500">{error}</p>
          <p className="text-sm text-gray-400 mt-4">
            Contacte o seu advogado para obter um novo link de acesso.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-gray-900">KAMAIA</h1>
            <p className="text-sm text-gray-500">Portal do Cliente</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-gray-900">{data.cliente.name}</p>
            <p className="text-sm text-gray-500">{data.cliente.email}</p>
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
            <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 uppercase">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Processos */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Meus Processos</h2>
          {data.processos.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Sem processos associados.
            </div>
          ) : (
            <div className="space-y-3">
              {data.processos.map((processo) => (
                <div key={processo.id}>
                  <button
                    onClick={() =>
                      selectedProcesso === processo.id
                        ? setSelectedProcesso(null)
                        : loadProcesso(processo.id)
                    }
                    className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Scale className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{processo.title}</p>
                          <p className="text-sm text-gray-500">
                            {processo.processoNumber} &middot; {processo.type} &middot; {processo.court || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-1 text-xs font-medium rounded', STATUS_COLORS[processo.status])}>
                          {processo.status}
                        </span>
                        <span className="text-xs text-gray-400">{processo.stage}</span>
                        <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform', selectedProcesso === processo.id && 'rotate-90')} />
                      </div>
                    </div>
                  </button>

                  {/* Processo detail */}
                  {selectedProcesso === processo.id && processoDetail && (
                    <div className="ml-8 mt-2 bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                      {/* Prazos */}
                      {processoDetail.prazos?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Prazos</h4>
                          <div className="space-y-2">
                            {processoDetail.prazos.map((p: any) => (
                              <div key={p.id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{p.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className={cn('px-2 py-0.5 text-xs rounded', STATUS_COLORS[p.status])}>{p.status}</span>
                                  <span className="text-gray-500">{formatDate(p.dueDate)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      {processoDetail.events?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Ultimas Actualizacoes</h4>
                          <div className="space-y-2">
                            {processoDetail.events.map((e: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-gray-400 text-xs mt-0.5">{formatDate(e.createdAt)}</span>
                                <span className="text-gray-700">{e.description || e.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {processoDetail.documents?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Documentos</h4>
                          <div className="space-y-1">
                            {processoDetail.documents.map((d: any) => (
                              <div key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                                <FileText className="w-3 h-3 text-gray-400" />
                                <span>{d.title}</span>
                                <span className="text-gray-400 text-xs">({d.category})</span>
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

        {/* Upcoming Prazos */}
        {data.prazos.filter((p) => p.status === 'PENDENTE').length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Prazos Pendentes
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {data.prazos
                .filter((p) => p.status === 'PENDENTE')
                .map((prazo) => {
                  const isPast = new Date(prazo.dueDate) < new Date()
                  return (
                    <div key={prazo.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{prazo.title}</p>
                        <p className="text-sm text-gray-500">
                          {prazo.processo.processoNumber} &middot; {prazo.type}
                        </p>
                      </div>
                      <span className={cn('text-sm font-medium', isPast ? 'text-red-600' : 'text-amber-600')}>
                        {formatDate(prazo.dueDate)}
                      </span>
                    </div>
                  )
                })}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-4 mt-12">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-400">
          Kamaia &copy; {new Date().getFullYear()} — Portal do Cliente
        </div>
      </footer>
    </div>
  )
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    }>
      <PortalContent />
    </Suspense>
  )
}
