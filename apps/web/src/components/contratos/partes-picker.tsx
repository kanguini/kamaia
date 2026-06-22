'use client'

/**
 * PartesPicker — selecciona partes de um contrato em criação.
 *
 * Array editor que aceita:
 *  1. Pesquisa de Entidades existentes no tenant (autocomplete debounced)
 *  2. Criação rápida inline ("+ Nova entidade") sem perder o formulário
 *  3. Configuração de papel (PARTE_PRINCIPAL, CONTRAPARTE, etc.)
 *  4. Reordenação implícita pela ordem do array
 *
 * Por defeito sugere 2 entradas: a primeira como PARTE_PRINCIPAL (SELF
 * do tenant — ainda não temos esse conceito wired, deixamos vazia),
 * a segunda como CONTRAPARTE. Utilizador pode adicionar mais.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, X, Search, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import {
  PartePapel,
  PaginatedResponse,
  EntidadeTipo,
  EntidadeNacionalidadeCambial,
} from '@kamaia/shared-types'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useMutation } from '@/hooks/use-api'

export interface ParteInput {
  entidadeId: string
  entidadeNome: string // só client-side, para display
  papel: PartePapel
  representanteNome?: string
  representanteCargo?: string
  representanteBI?: string
}

interface EntidadeOpt {
  id: string
  nome: string
  nif?: string | null
  tipo: EntidadeTipo
}

const PAPEL_LABELS: Record<PartePapel, string> = {
  [PartePapel.PARTE_PRINCIPAL]: 'Parte principal',
  [PartePapel.CONTRAPARTE]: 'Contraparte',
  [PartePapel.GARANTE]: 'Garante',
  [PartePapel.TESTEMUNHA]: 'Testemunha',
  [PartePapel.NOTARIO]: 'Notário',
  [PartePapel.INTERVENIENTE_ACESSORIO]: 'Interveniente acessório',
}

export function PartesPicker({
  value,
  onChange,
}: {
  value: ParteInput[]
  onChange: (next: ParteInput[]) => void
}) {
  const empty = useMemo<ParteInput>(
    () => ({
      entidadeId: '',
      entidadeNome: '',
      papel: PartePapel.CONTRAPARTE,
    }),
    [],
  )

  // Sugere 1 entrada vazia inicial se array está vazio. Só na primeira render.
  useEffect(() => {
    if (value.length === 0) onChange([{ ...empty, papel: PartePapel.CONTRAPARTE }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateAt = (i: number, patch: Partial<ParteInput>) => {
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i))
  }
  const addNew = () => {
    onChange([...value, { ...empty }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((p, i) => (
        <ParteRow
          key={i}
          parte={p}
          onUpdate={(patch) => updateAt(i, patch)}
          onRemove={value.length > 1 ? () => removeAt(i) : undefined}
        />
      ))}
      <button
        type="button"
        onClick={addNew}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: '1px dashed var(--k2-border-strong, var(--k2-border))',
          color: 'var(--k2-text-dim)',
          padding: '6px 12px',
          borderRadius: 'var(--k2-radius-sm)',
          cursor: 'pointer',
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Plus size={12} /> Adicionar parte
      </button>
    </div>
  )
}

function ParteRow({
  parte,
  onUpdate,
  onRemove,
}: {
  parte: ParteInput
  onUpdate: (patch: Partial<ParteInput>) => void
  onRemove?: () => void
}) {
  return (
    <div
      style={{
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius-sm)',
        padding: 12,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 10, alignItems: 'flex-start' }}>
        <EntidadePicker
          value={
            parte.entidadeId
              ? { id: parte.entidadeId, nome: parte.entidadeNome, tipo: EntidadeTipo.PESSOA_COLECTIVA }
              : null
          }
          onChange={(e) =>
            onUpdate({
              entidadeId: e?.id ?? '',
              entidadeNome: e?.nome ?? '',
            })
          }
        />
        <Select
          value={parte.papel}
          onChange={(e) => onUpdate({ papel: e.target.value as PartePapel })}
        >
          {Object.values(PartePapel).map((p) => (
            <option key={p} value={p}>{PAPEL_LABELS[p]}</option>
          ))}
        </Select>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remover parte"
            aria-label="Remover parte"
            style={{
              background: 'transparent',
              border: '1px solid var(--k2-border)',
              color: 'var(--k2-text-mute)',
              padding: '7px',
              borderRadius: 'var(--k2-radius-sm)',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Representante (opcional, expansível por linha) */}
      <details>
        <summary style={{ fontSize: 11, color: 'var(--k2-text-mute)', cursor: 'pointer' }}>
          Representante (opcional)
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <Input
            placeholder="Nome"
            value={parte.representanteNome ?? ''}
            onChange={(e) => onUpdate({ representanteNome: e.target.value })}
          />
          <Input
            placeholder="Cargo"
            value={parte.representanteCargo ?? ''}
            onChange={(e) => onUpdate({ representanteCargo: e.target.value })}
          />
          <Input
            placeholder="BI / Passaporte"
            value={parte.representanteBI ?? ''}
            onChange={(e) => onUpdate({ representanteBI: e.target.value })}
          />
        </div>
      </details>
    </div>
  )
}

// ─── EntidadePicker (autocomplete + quick-add) ──────────

function EntidadePicker({
  value,
  onChange,
}: {
  value: EntidadeOpt | null
  onChange: (e: EntidadeOpt | null) => void
}) {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [results, setResults] = useState<EntidadeOpt[]>([])
  const [loading, setLoading] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200)
    return () => clearTimeout(t)
  }, [q])

  // Fetch when open + debouncedQ changes
  useEffect(() => {
    if (!open || status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    // Entidades list aceita `?q=` (não `?search=`)
    const url = `/entidades?limit=10${debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ''}`
    api<PaginatedResponse<EntidadeOpt>>(url, { token: session.accessToken })
      .then((r) => {
        if (!cancelled) setResults(r.data ?? [])
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, debouncedQ, session?.accessToken, status])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {value && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={pickerBtnStyle}
        >
          <span style={{ color: 'var(--k2-text)', fontWeight: 500 }}>{value.nome}</span>
          <span style={{ color: 'var(--k2-text-mute)', fontSize: 11, marginLeft: 'auto' }}>trocar</span>
        </button>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--k2-text-mute)',
                pointerEvents: 'none',
              }}
            />
            <Input
              placeholder="Pesquisar entidade…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              style={{ paddingLeft: 28 }}
              autoComplete="off"
            />
          </div>
          {open && (
            <div style={popoverStyle}>
              {loading && <div style={popItemMuteStyle}>A pesquisar…</div>}
              {!loading && results.length === 0 && (
                <div style={popItemMuteStyle}>Sem resultados.</div>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(r)
                    setOpen(false)
                    setQ('')
                  }}
                  style={popItemBtnStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--k2-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontWeight: 500 }}>{r.nome}</span>
                  {r.nif && <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>NIF {r.nif}</span>}
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--k2-border)', marginTop: 4, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setQuickAddOpen(true)
                  }}
                  style={{
                    ...popItemBtnStyle,
                    color: 'var(--k2-accent)',
                    fontWeight: 500,
                  }}
                >
                  <UserPlus size={12} /> Nova entidade {q ? `"${q}"` : ''}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {quickAddOpen && (
        <QuickAddEntidadeInline
          initialName={q}
          onCancel={() => setQuickAddOpen(false)}
          onCreated={(e) => {
            onChange(e)
            setQuickAddOpen(false)
            setOpen(false)
            setQ('')
          }}
        />
      )}
    </div>
  )
}

// ─── Quick add inline ──────────────────────────────────

function QuickAddEntidadeInline({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string
  onCancel: () => void
  onCreated: (e: EntidadeOpt) => void
}) {
  const [nome, setNome] = useState(initialName)
  const [tipo, setTipo] = useState<EntidadeTipo>(EntidadeTipo.PESSOA_COLECTIVA)
  const [nif, setNif] = useState('')
  const [residente, setResidente] = useState<EntidadeNacionalidadeCambial>(
    EntidadeNacionalidadeCambial.RESIDENTE,
  )
  const { mutate, loading, error } = useMutation<unknown, EntidadeOpt>('/entidades', 'POST')

  const submit = async () => {
    const r = await mutate({
      nome: nome.trim(),
      tipo,
      nacionalidadeCambial: residente,
      nif: nif.trim() || undefined,
    })
    if (r) onCreated(r)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        zIndex: 30,
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border-strong)',
        borderRadius: 'var(--k2-radius-sm)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Nova entidade
      </div>
      <Input placeholder="Nome / Razão social" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as EntidadeTipo)}>
          <option value={EntidadeTipo.PESSOA_COLECTIVA}>Pessoa colectiva</option>
          <option value={EntidadeTipo.PESSOA_SINGULAR}>Pessoa singular</option>
        </Select>
        <Select
          value={residente}
          onChange={(e) => setResidente(e.target.value as EntidadeNacionalidadeCambial)}
        >
          <option value={EntidadeNacionalidadeCambial.RESIDENTE}>Residente</option>
          <option value={EntidadeNacionalidadeCambial.NAO_RESIDENTE}>Não-residente</option>
        </Select>
      </div>
      <Input placeholder="NIF (opcional)" value={nif} onChange={(e) => setNif(e.target.value)} />
      {error && <div style={{ fontSize: 11, color: 'var(--k2-bad)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="button" loading={loading} onClick={() => void submit()} disabled={!nome.trim()}>
          Criar
        </Button>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────

const pickerBtnStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--k2-bg-elev-2, var(--k2-bg-elev))',
  border: '1px solid var(--k2-border)',
  color: 'var(--k2-text)',
  padding: '7px 10px',
  borderRadius: 'var(--k2-radius-sm)',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 20,
  background: 'var(--k2-bg-elev)',
  border: '1px solid var(--k2-border-strong)',
  borderRadius: 'var(--k2-radius-sm)',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)',
  padding: 4,
  maxHeight: 280,
  overflowY: 'auto',
}

const popItemBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: 'var(--k2-text)',
  padding: '6px 10px',
  borderRadius: 'var(--k2-radius-sm)',
  cursor: 'pointer',
  fontSize: 12,
  textAlign: 'left',
}

const popItemMuteStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--k2-text-mute)',
}
