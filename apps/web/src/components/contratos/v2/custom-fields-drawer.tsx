'use client'

/**
 * Drawer de edição de custom fields per-contrato.
 *
 * Carrega definitions + values existentes, renderiza um form
 * dinâmico (input por tipo), submete via PATCH em massa. Usa o
 * <Drawer position="center"> standard do design system.
 *
 * Tipos suportados:
 *   STRING/TEXT   <Input> / <Textarea>
 *   NUMBER        <Input type="number">
 *   DATE          <Input type="date">
 *   BOOLEAN       <Switch>
 *   SELECT        <Select>
 *   MONEY         valor + moeda lado-a-lado
 *   ADDRESS       (não implementado em Sprint 2.4)
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'

interface FieldDef {
  id: string
  key: string
  label: string
  hint: string | null
  type: string
  options: unknown
  required: boolean
}

interface FieldRow {
  definition: FieldDef
  value: { v?: unknown } | { rua?: string; cidade?: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  contratoId: string
  onSaved?: () => void
}

export function CustomFieldsDrawer({ open, onClose, contratoId, onSaved }: Props) {
  const { data: session } = useSession()
  const [items, setItems] = useState<FieldRow[] | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !session?.accessToken) return
    setErr(null)
    api<FieldRow[]>(`/custom-fields/by-contrato/${contratoId}`, {
      token: session.accessToken,
    })
      .then((rows) => {
        setItems(rows)
        // Pré-popula com valores existentes
        const initial: Record<string, unknown> = {}
        for (const r of rows) {
          if (!r.value) continue
          if (r.definition.type === 'ADDRESS') continue // não editamos por agora
          if (r.definition.type === 'MONEY') {
            const m = r.value as { v?: number; moeda?: string }
            initial[r.definition.key] = { v: m.v, moeda: m.moeda }
          } else {
            const v = (r.value as { v?: unknown }).v
            initial[r.definition.key] = v
          }
        }
        setValues(initial)
      })
      .catch(() => {
        setItems([])
      })
  }, [open, contratoId, session?.accessToken])

  const submit = async () => {
    if (!session?.accessToken) return
    setSubmitting(true)
    setErr(null)
    try {
      // Remove keys com valor undefined/null/empty para não tentar gravar
      const cleaned: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(values)) {
        if (v === undefined || v === null || v === '') continue
        cleaned[k] = v
      }
      await api(`/custom-fields/by-contrato/${contratoId}`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({ values: cleaned }),
      })
      onSaved?.()
      onClose()
    } catch (e) {
      const ex = e as { error?: string; details?: { errors?: Record<string, string> } }
      if (ex.details?.errors) {
        setErr(
          'Erros: ' +
            Object.entries(ex.details.errors)
              .map(([k, v]) => `${k}: ${v}`)
              .join('; '),
        )
      } else {
        setErr(ex.error ?? 'Erro ao gravar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const setValue = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  return (
    <Drawer open={open} onClose={onClose} width={560}>
      <DrawerHeader
        title="Editar detalhes do tipo"
        subtitle="Campos custom definidos pelo TipoContrato. Valores são validados pelo tipo."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div
            style={{
              background: 'var(--color-danger-bg, rgba(220,38,38,0.08))',
              color: 'var(--k2-bad)',
              padding: '10px 14px',
              borderRadius: 'var(--k2-radius-sm)',
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}

        {items === null && (
          <div style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>
            A carregar campos…
          </div>
        )}

        {items && items.length === 0 && (
          <div style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>
            Este tipo de contrato ainda não tem campos custom definidos.
            Configura em Biblioteca → Tipos de contrato.
          </div>
        )}

        {items && items.length > 0 && (
          <form
            id="cf-form"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            {items.map((it) => (
              <FieldRenderer
                key={it.definition.id}
                def={it.definition}
                value={values[it.definition.key]}
                onChange={(v) => setValue(it.definition.key, v)}
              />
            ))}
          </form>
        )}
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="cf-form"
          loading={submitting}
          disabled={!items || items.length === 0}
        >
          Gravar
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}

function FieldRenderer({
  def,
  value,
  onChange,
}: {
  def: FieldDef
  value: unknown
  onChange: (v: unknown) => void
}) {
  const labelEl = (
    <div className="cf-label">
      {def.label}
      {def.required && <span className="cf-req">*</span>}
    </div>
  )

  let control: React.ReactNode = null
  switch (def.type) {
    case 'STRING':
      control = (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={def.required}
        />
      )
      break
    case 'TEXT':
      control = (
        <Textarea
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={def.required}
        />
      )
      break
    case 'NUMBER':
      control = (
        <Input
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => {
            const n = e.target.value === '' ? undefined : Number(e.target.value)
            onChange(typeof n === 'number' && Number.isFinite(n) ? n : undefined)
          }}
          required={def.required}
        />
      )
      break
    case 'DATE':
      control = (
        <Input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          required={def.required}
        />
      )
      break
    case 'BOOLEAN':
      control = (
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--k2-text)',
          }}
        >
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value === true ? 'Sim' : 'Não'}</span>
        </label>
      )
      break
    case 'SELECT': {
      const options = Array.isArray(def.options) ? (def.options as string[]) : []
      control = (
        <Select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          required={def.required}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )
      break
    }
    case 'MONEY': {
      const m = (value as { v?: number; moeda?: string }) ?? { v: undefined, moeda: 'AOA' }
      control = (
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            type="number"
            value={typeof m.v === 'number' ? String(m.v) : ''}
            onChange={(e) => {
              const n = e.target.value === '' ? undefined : Number(e.target.value)
              const num =
                typeof n === 'number' && Number.isFinite(n) ? n : undefined
              onChange({ v: num, moeda: m.moeda ?? 'AOA' })
            }}
            style={{ flex: 1 }}
            placeholder="0"
            required={def.required}
          />
          <Select
            value={m.moeda ?? 'AOA'}
            onChange={(e) =>
              onChange({ v: m.v, moeda: e.target.value })
            }
            style={{ width: 90 }}
          >
            <option value="AOA">AOA</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </div>
      )
      break
    }
    case 'ADDRESS':
    default:
      control = (
        <div
          style={{
            fontSize: 11,
            color: 'var(--k2-text-mute)',
            padding: '6px 10px',
            background: 'var(--k2-bg)',
            border: '1px dashed var(--k2-border)',
            borderRadius: 'var(--k2-radius-sm)',
          }}
        >
          Tipo {def.type} ainda não editável neste drawer.
        </div>
      )
  }

  return (
    <label className="cf-field">
      {labelEl}
      {control}
      {def.hint && <div className="cf-hint">{def.hint}</div>}
      <style jsx>{`
        .cf-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cf-label {
          font-size: 12px;
          color: var(--k2-text-dim);
        }
        .cf-req {
          color: var(--k2-bad);
          margin-left: 2px;
        }
        .cf-hint {
          font-size: 11px;
          color: var(--k2-text-mute);
          line-height: 1.4;
        }
      `}</style>
    </label>
  )
}
