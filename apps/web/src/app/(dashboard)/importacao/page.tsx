'use client'

/**
 * Kamaia CLM — Importação em lote.
 *
 * Lista lotes de importação + acção para criar um novo.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoteEstado } from '@kamaia/shared-types'
import { fmtDateTime } from '@/lib/clm-format'

interface Lote {
  id: string
  nome: string
  estado: LoteEstado
  totalLinhas: number
  linhasCriadas: number
  linhasFalhadas: number
  criadoEm: string
}

const ESTADO_VARIANT: Partial<Record<LoteEstado, string>> = {
  [LoteEstado.EM_FILA]: 'pendente',
  [LoteEstado.PROCESSANDO]: 'info',
  [LoteEstado.CONCLUIDO]: 'success',
  [LoteEstado.CONCLUIDO_COM_ERROS]: 'warning',
  [LoteEstado.FALHOU]: 'danger',
  [LoteEstado.CANCELADO]: 'default',
}

export default function ImportacaoPage() {
  // useApi desembrulha o `data` de topo — o estado É o array de lotes.
  // Ler `.data` outra vez dava undefined (lista sempre "sem lotes").
  const { data, loading, refetch } = useApi<Lote[]>('/importacao/lotes?limit=50')
  const [showCreate, setShowCreate] = useState(false)
  const lotes = data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Importação</h1>
        </div>
        <Button leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Novo lote</Button>
      </header>

      {loading && <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>}
      {!loading && lotes.length === 0 && (
        <div style={{ color: 'var(--k2-text-mute)' }}>Ainda não tens lotes de importação.</div>
      )}

      {lotes.length > 0 && (
        <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
          {lotes.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderTop: '1px solid var(--k2-border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{l.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
                  {fmtDateTime(l.criadoEm)} · {l.linhasCriadas}/{l.totalLinhas} criadas
                  {l.linhasFalhadas > 0 && ` · ${l.linhasFalhadas} falhadas`}
                </div>
              </div>
              <Badge variant={ESTADO_VARIANT[l.estado] ?? 'default'}>{l.estado.replaceAll('_', ' ')}</Badge>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateLoteModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function CreateLoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState('')
  const { mutate, loading, error } = useMutation('/importacao/lotes', 'POST')
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border-strong)',
          borderRadius: 'var(--k2-radius)',
          padding: 20,
          width: 'min(500px, 92vw)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Novo lote de importação</h2>
        {error && <div style={{ color: 'var(--k2-bad)', fontSize: 12 }}>{error}</div>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
          Nome do lote
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Carteira imobiliária 2024-Q4" autoFocus />
        </label>
        <p style={{ fontSize: 11, color: 'var(--k2-text-mute)', margin: 0 }}>
          Depois de criado, podes carregar os documentos do lote para OCR + extracção.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            loading={loading}
            onClick={async () => {
              const r = await mutate({ nome })
              if (r) onCreated()
            }}
          >
            Criar lote
          </Button>
        </div>
      </div>
    </div>
  )
}
