'use client'

/**
 * Kamaia CLM — Partilha (colaboradores externos por contrato).
 *
 * Lista os colaboradores convidados a este contrato + permite criar
 * novos convites + revogar acessos. O magic-link com token completo só
 * volta no momento da criação (server só guarda hash), então a UI mostra
 * o URL UMA VEZ + botão copiar — depois disso só ficam os metadados
 * (prefix de 8 chars + estado + expiração).
 *
 * Fluxo:
 *  1. Owner clica "Convidar" → Drawer com email + nome + tipo + TTL
 *  2. Server cria + envia email + devolve {token, url}
 *  3. UI exibe banner verde com URL copiável (closeable)
 *  4. Lista actualiza automaticamente
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Copy, Check, Trash2, Mail, Link2, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import {
  ColaboradorTipoAcesso,
  COLABORADOR_TIPO_ACESSO_LABELS,
  ColaboradorEstado,
} from '@kamaia/shared-types'
import { fmtDate, fmtDateTime } from '@/lib/clm-format'

interface Colaborador {
  id: string
  email: string
  nome: string | null
  tipoAcesso: ColaboradorTipoAcesso
  estado: ColaboradorEstado
  tokenPrefix: string
  expiresAt: string
  convidadoEm: string
  aceitouEm: string | null
  revogadoEm: string | null
  ultimaActividade: string | null
}

interface ColaboradorCreated extends Colaborador {
  token: string
  url: string
  emailStubbed?: boolean
}

export function PartilhaTab({ contratoId }: { contratoId: string }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openInvite, setOpenInvite] = useState(false)
  const [recent, setRecent] = useState<ColaboradorCreated | null>(null)

  const fetchList = async () => {
    if (status !== 'authenticated' || !session?.accessToken) return
    setLoading(true)
    try {
      const data = await api<Colaborador[]>(
        `/contratos/${contratoId}/colaboradores`,
        { token: session.accessToken },
      )
      setItems(data ?? [])
      setError(null)
    } catch (e) {
      setError((e as { error?: string })?.error ?? 'Erro a carregar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId, session?.accessToken, status])

  const onCreated = (created: ColaboradorCreated) => {
    setRecent(created)
    setOpenInvite(false)
    setItems((prev) => [created, ...prev])
  }

  const onRevogar = async (id: string) => {
    if (!session?.accessToken) return
    if (!confirm('Revogar o acesso? O colaborador deixa de poder abrir o link.')) return
    try {
      await api(`/contratos/${contratoId}/colaboradores/${id}`, {
        method: 'DELETE',
        token: session.accessToken,
      })
      void fetchList()
    } catch (e) {
      alert((e as { error?: string })?.error ?? 'Erro ao revogar')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--k2-text-dim)' }}>
            Convida pessoas externas (contraparte, advogado, signatário) a aceder a este contrato. Cada convite gera um link único.
          </div>
        </div>
        <Button leftIcon={<Plus size={14} />} onClick={() => setOpenInvite(true)}>
          Convidar
        </Button>
      </div>

      {recent && <RecentInviteBanner data={recent} onDismiss={() => setRecent(null)} />}

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--k2-text-mute)', fontSize: 13 }}>A carregar…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 32, color: 'var(--k2-text-mute)', fontSize: 13, textAlign: 'center' }}>
            Ainda não convidaste ninguém. Usa “Convidar” para começar.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--k2-bg-elev-2)', color: 'var(--k2-text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Th>Pessoa</Th>
                <Th>Acesso</Th>
                <Th>Estado</Th>
                <Th>Expira</Th>
                <Th>Última actividade</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--k2-border)' }}>
                  <Td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--k2-text)' }}>{c.nome || c.email}</span>
                      {c.nome && (
                        <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{c.email}</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={c.tipoAcesso === ColaboradorTipoAcesso.ASSINATURA ? 'success' : c.tipoAcesso === ColaboradorTipoAcesso.COMENTARIO ? 'info' : 'default'}>
                      {COLABORADOR_TIPO_ACESSO_LABELS[c.tipoAcesso]}
                    </Badge>
                  </Td>
                  <Td>
                    <EstadoBadge estado={c.estado} />
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--k2-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDate(c.expiresAt)}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>
                      {c.ultimaActividade ? fmtDateTime(c.ultimaActividade) : '—'}
                    </span>
                  </Td>
                  <Td>
                    {c.estado !== ColaboradorEstado.REVOGADO && (
                      <button
                        onClick={() => onRevogar(c.id)}
                        title="Revogar acesso"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--k2-border)',
                          color: 'var(--k2-bad)',
                          padding: '4px 8px',
                          borderRadius: 'var(--k2-radius-sm)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                        }}
                      >
                        <Trash2 size={12} /> Revogar
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <InviteDrawer
        open={openInvite}
        onClose={() => setOpenInvite(false)}
        contratoId={contratoId}
        onCreated={onCreated}
      />
    </div>
  )
}

function InviteDrawer({
  open,
  onClose,
  contratoId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
  onCreated: (c: ColaboradorCreated) => void
}) {
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [tipoAcesso, setTipoAcesso] = useState<ColaboradorTipoAcesso>(
    ColaboradorTipoAcesso.COMENTARIO,
  )
  const [ttlDias, setTtlDias] = useState('30')
  const { mutate, loading, error } = useMutation<unknown, ColaboradorCreated>(
    `/contratos/${contratoId}/colaboradores`,
    'POST',
  )

  useEffect(() => {
    if (!open) {
      setEmail('')
      setNome('')
      setTipoAcesso(ColaboradorTipoAcesso.COMENTARIO)
      setTtlDias('30')
    }
  }, [open])

  const submit = async () => {
    const ttl = Math.max(1, Math.min(365, Number(ttlDias) || 30))
    const result = await mutate({
      email: email.trim(),
      nome: nome.trim() || undefined,
      tipoAcesso,
      ttlDias: ttl,
    })
    if (result) onCreated(result)
  }

  return (
    <Drawer open={open} onClose={onClose} width={520}>
      <DrawerHeader
        title="Convidar pessoa externa"
        subtitle="Gera um link único com nível de acesso scoped a este contrato."
        onClose={onClose}
      />
      <DrawerBody>
        {error && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}
        <form
          id="convidar-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Email
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contraparte@exemplo.com"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Nome (opcional)
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome próprio + apelido"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Nível de acesso
            <Select value={tipoAcesso} onChange={(e) => setTipoAcesso(e.target.value as ColaboradorTipoAcesso)}>
              {Object.values(ColaboradorTipoAcesso).map((t) => (
                <option key={t} value={t}>{COLABORADOR_TIPO_ACESSO_LABELS[t]}</option>
              ))}
            </Select>
            <small style={{ color: 'var(--k2-text-mute)', fontSize: 11, marginTop: 2 }}>
              {tipoAcesso === ColaboradorTipoAcesso.LEITURA
                ? 'Só consulta — não pode comentar nem assinar.'
                : tipoAcesso === ColaboradorTipoAcesso.COMENTARIO
                ? 'Pode consultar e deixar comentários ancorados em cláusulas.'
                : 'Pode consultar, comentar e assinar a versão actual.'}
            </small>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Validade (dias)
            <Input
              type="number"
              min={1}
              max={365}
              value={ttlDias}
              onChange={(e) => setTtlDias(e.target.value)}
            />
            <small style={{ color: 'var(--k2-text-mute)', fontSize: 11 }}>
              Default 30 dias · máx 365.
            </small>
          </label>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="convidar-form" loading={loading} leftIcon={<Mail size={13} />}>
          Enviar convite
        </Button>
      </DrawerFooter>
    </Drawer>
  )
}

/**
 * Banner verde mostrado UMA VEZ a seguir à criação — contém o URL
 * com o token raw. Owner copia daqui caso o email não chegue (ou
 * para partilhar por WhatsApp/presencial).
 */
function RecentInviteBanner({
  data,
  onDismiss,
}: {
  data: ColaboradorCreated
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback noop */
    }
  }
  return (
    <div
      style={{
        background: 'var(--color-success-bg, #ecfdf5)',
        border: '1px solid var(--color-success-border, #a7f3d0)',
        color: 'var(--color-success-text, #047857)',
        padding: '14px 16px',
        borderRadius: 'var(--k2-radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          Convite criado para {data.nome || data.email}
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 12, opacity: 0.9 }}>
        {data.emailStubbed
          ? 'Email não enviado (RESEND_API_KEY ausente). Copia o link e partilha manualmente:'
          : 'Email enviado. Caso a contraparte prefira outro canal, copia o link:'}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 'var(--k2-radius-sm)',
          padding: '6px 8px',
        }}
      >
        <Link2 size={13} style={{ flexShrink: 0 }} />
        <code style={{ flex: 1, fontSize: 12, color: '#0f5132', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.url}
        </code>
        <button
          onClick={copy}
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            color: copied ? '#047857' : '#1f2937',
            padding: '4px 8px',
            borderRadius: 'var(--k2-radius-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Clock size={11} /> Este URL é único, expira em {fmtDate(data.expiresAt)} e não voltará a aparecer.
      </div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: ColaboradorEstado }) {
  switch (estado) {
    case ColaboradorEstado.PENDENTE:
      return <Badge variant="pendente">Pendente</Badge>
    case ColaboradorEstado.ACTIVO:
      return <Badge variant="success">Activo</Badge>
    case ColaboradorEstado.EXPIRADO:
      return <Badge variant="warning">Expirado</Badge>
    case ColaboradorEstado.REVOGADO:
      return <Badge variant="danger">Revogado</Badge>
    default:
      return <Badge variant="default">{estado}</Badge>
  }
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 14px' }}>{children}</td>
}
