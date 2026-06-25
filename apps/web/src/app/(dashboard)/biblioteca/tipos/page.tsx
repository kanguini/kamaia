'use client'

/**
 * Configurações → Tipos de Contrato.
 *
 * Lista combinada do catálogo:
 *  - Global (tenantId=null) — partilhado, vem do seed
 *  - Tenant — criados por ADMIN/LEGAL_LEAD do tenant actual
 *
 * Acções:
 *  - ADMIN/LEGAL_LEAD: criar tipo tenant-specific
 *  - Outros roles: read-only (precisam destes tipos para criar contratos)
 *
 * Quando a lista está vazia (e.g. produção sem seed), mostra
 * empty-state explicando o problema + CTA "Criar primeiro tipo"
 * + nota sobre o catálogo global.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import {
  TipoContratoCategoria,
  TIPO_CONTRATO_CATEGORIA_LABELS,
} from '@kamaia/shared-types'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from '@/components/ui/drawer'
import { AlertTriangle, BookOpen, Plus } from 'lucide-react'
import { useTenants } from '@/hooks/use-tenants'
import { Role } from '@kamaia/shared-types'

interface TipoContrato {
  id: string
  tenantId: string | null
  codigo: string
  nome: string
  categoria: TipoContratoCategoria
  descricao: string | null
  tgisVerbaNumero: string | null
  requerNotario: boolean
  registosRequeridos: string[]
  retencaoIRTpadrao: boolean
  clausulasObrigatorias: string[]
  isActive: boolean
}

export default function TiposContratoPage() {
  const { data: session, status } = useSession()
  const { active } = useTenants()
  const [items, setItems] = useState<TipoContrato[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filterCategoria, setFilterCategoria] = useState<TipoContratoCategoria | ''>('')

  // Apenas ADMIN/LEGAL_LEAD podem criar
  const canCreate =
    active?.role === Role.ADMIN || active?.role === Role.LEGAL_LEAD

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    setLoading(true)
    const url = filterCategoria
      ? `/tipos-contrato?categoria=${filterCategoria}`
      : '/tipos-contrato'
    api<TipoContrato[]>(url, { token: session.accessToken })
      .then((res) => {
        if (!cancelled) setItems(res ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filterCategoria, session?.accessToken, status, refreshKey])

  const globais = items.filter((t) => t.tenantId === null)
  const tenantOnly = items.filter((t) => t.tenantId !== null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Tipos de contrato</h2>
          <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
            Catálogo usado no dropdown &ldquo;Tipo de contrato&rdquo; em todos os
            formulários. Tipos globais vêm pré-instalados; podes adicionar
            tipos específicos do teu tenant.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowForm(true)} leftIcon={<Plus size={14} />}>
            Novo tipo
          </Button>
        )}
      </header>

      {/* Filtro por categoria */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>Filtrar:</label>
        <Select
          value={filterCategoria}
          onChange={(e) =>
            setFilterCategoria(e.target.value as TipoContratoCategoria | '')
          }
          style={{ minWidth: 200 }}
        >
          <option value="">Todas as categorias</option>
          {Object.values(TipoContratoCategoria).map((c) => (
            <option key={c} value={c}>
              {TIPO_CONTRATO_CATEGORIA_LABELS[c]}
            </option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--k2-text-mute)' }}>
          {globais.length} globais · {tenantOnly.length} do tenant
        </span>
      </div>

      {/* Empty state (catálogo nunca foi seeded ou está vazio) */}
      {!loading && items.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: 40,
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius)',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--k2-text)' }}>
              Nenhum tipo de contrato disponível
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--k2-text-dim)',
                marginTop: 6,
                maxWidth: 480,
                lineHeight: 1.6,
              }}
            >
              O catálogo global (com NDA, Locação, Prestação de Serviços,
              Compra e Venda, etc.) ainda não foi populado neste ambiente.
              Podes <strong>criar um tipo tenant-specific</strong> para
              começares, ou contactar o admin do projecto para correr o
              seed do catálogo global.
            </div>
          </div>
          {canCreate && (
            <Button onClick={() => setShowForm(true)} leftIcon={<Plus size={14} />}>
              Criar primeiro tipo
            </Button>
          )}
        </div>
      )}

      {/* Tabela combinada */}
      {!loading && items.length > 0 && (
        <div
          style={{
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  background: 'var(--k2-bg-elev-2)',
                  color: 'var(--k2-text-dim)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <Th>Código</Th>
                <Th>Nome</Th>
                <Th>Categoria</Th>
                <Th>Compliance</Th>
                <Th>Origem</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--k2-border)' }}>
                  <Td>
                    <code
                      style={{
                        fontSize: 11,
                        color: 'var(--k2-text-dim)',
                        background: 'var(--k2-bg)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {t.codigo}
                    </code>
                  </Td>
                  <Td>
                    <div style={{ color: 'var(--k2-text)' }}>{t.nome}</div>
                    {t.descricao && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--k2-text-mute)',
                          marginTop: 2,
                          maxWidth: 360,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.descricao}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Badge variant="default">
                      {TIPO_CONTRATO_CATEGORIA_LABELS[t.categoria]}
                    </Badge>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {t.tgisVerbaNumero && (
                        <Badge variant="warning">TGIS {t.tgisVerbaNumero}</Badge>
                      )}
                      {t.requerNotario && <Badge variant="warning">Notário</Badge>}
                      {t.retencaoIRTpadrao && (
                        <Badge variant="warning">Retenção IRT</Badge>
                      )}
                      {t.registosRequeridos.length > 0 && (
                        <Badge variant="warning">
                          {t.registosRequeridos.length} registo(s)
                        </Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {t.tenantId === null ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--k2-text-dim)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <BookOpen size={11} /> Global
                      </span>
                    ) : (
                      <Badge variant="success">Tenant</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div
          style={{
            padding: 30,
            color: 'var(--k2-text-mute)',
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          A carregar catálogo…
        </div>
      )}

      {showForm && (
        <NovoTipoDrawer
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Drawer de criação
// ─────────────────────────────────────────

function NovoTipoDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const { data: session } = useSession()
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<TipoContratoCategoria>(
    TipoContratoCategoria.SERVICOS,
  )
  const [descricao, setDescricao] = useState('')
  const [tgisVerbaNumero, setTgisVerbaNumero] = useState('')
  const [requerNotario, setRequerNotario] = useState(false)
  const [retencaoIRTpadrao, setRetencaoIRTpadrao] = useState(false)
  const [registosInput, setRegistosInput] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.accessToken) return
    setSubmitting(true)
    setError(null)

    const body: Record<string, unknown> = {
      codigo: codigo.toUpperCase().replace(/\s+/g, '_'),
      nome,
      categoria,
    }
    if (descricao) body.descricao = descricao
    if (tgisVerbaNumero) body.tgisVerbaNumero = tgisVerbaNumero
    if (requerNotario) body.requerNotario = true
    if (retencaoIRTpadrao) body.retencaoIRTpadrao = true
    const registos = registosInput
      .split(',')
      .map((s) => s.trim().toUpperCase().replace(/\s+/g, '_'))
      .filter(Boolean)
    if (registos.length > 0) body.registosRequeridos = registos

    try {
      await api('/tipos-contrato', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify(body),
      })
      onCreated()
    } catch (err: unknown) {
      const e = err as { error?: string; message?: string }
      setError(e.error || e.message || 'Erro a criar tipo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open onClose={onClose} width={580}>
      <DrawerHeader
        title="Novo tipo de contrato"
        subtitle="Específico deste tenant — não aparece para outros."
        onClose={onClose}
      />
      <DrawerBody>
        {error && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--k2-radius-sm)',
              fontSize: 13,
              color: '#fca5a5',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        <form id="novo-tipo-form" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Row>
            <Field label="Código *" hint="Identificador único (ex.: NDA, LOCACAO_HABITACAO).">
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="ex.: LOCACAO_HABITACAO"
                required
                autoFocus
              />
            </Field>
            <Field label="Categoria *">
              <Select
                value={categoria}
                onChange={(e) =>
                  setCategoria(e.target.value as TipoContratoCategoria)
                }
              >
                {Object.values(TipoContratoCategoria).map((c) => (
                  <option key={c} value={c}>
                    {TIPO_CONTRATO_CATEGORIA_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </Row>

          <Field label="Nome *" hint="Como aparece no dropdown.">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex.: Contrato de Arrendamento Habitacional"
              required
            />
          </Field>

          <Field label="Descrição (opcional)">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Notas internas sobre este tipo."
              style={textareaStyle}
            />
          </Field>

          <SectionTitle>Gatilhos regulatórios (defaults)</SectionTitle>
          <p style={{ fontSize: 11, color: 'var(--k2-text-mute)', margin: 0, marginTop: -8 }}>
            Aplicados a contratos novos deste tipo — podem ser sobrescritos
            por contrato. O Compliance Engine usa estes valores para
            sugerir actos regulatórios.
          </p>

          <Row>
            <Field label="Verba TGIS" hint="Imposto de Selo — ex.: 12.5, 23.">
              <Input
                value={tgisVerbaNumero}
                onChange={(e) => setTgisVerbaNumero(e.target.value)}
                placeholder="ex.: 23"
              />
            </Field>
            <Field label="Registos requeridos" hint="Separa por vírgula — ex.: REGISTO_PREDIAL, REGISTO_AUTOMOVEL.">
              <Input
                value={registosInput}
                onChange={(e) => setRegistosInput(e.target.value)}
                placeholder="ex.: REGISTO_PREDIAL"
              />
            </Field>
          </Row>

          <Row>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={requerNotario}
                onChange={(e) => setRequerNotario(e.target.checked)}
              />
              <span>Requer escritura/reconhecimento notarial</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={retencaoIRTpadrao}
                onChange={(e) => setRetencaoIRTpadrao(e.target.checked)}
              />
              <span>Retenção IRT na fonte (padrão)</span>
            </label>
          </Row>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--k2-text-mute)' }}>
          * Obrigatório
        </div>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" form="novo-tipo-form" loading={submitting}>
          Criar tipo
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Helpers visuais ─────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '10px 14px',
        textAlign: 'left',
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{children}</td>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--k2-text-mute)', lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </label>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--k2-text-mute)',
        margin: '6px 0 0 0',
      }}
    >
      {children}
    </h3>
  )
}

const textareaStyle: React.CSSProperties = {
  background: 'var(--k2-bg)',
  color: 'var(--k2-text)',
  border: '1px solid var(--k2-border)',
  borderRadius: 'var(--k2-radius-sm)',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'vertical',
}
