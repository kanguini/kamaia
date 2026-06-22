'use client'

/**
 * Kamaia CLM — página pública do colaborador externo.
 *
 * Endpoint: `/c/<prefix>-<secret>`
 * Sem autenticação: o token no path resolve para colaboradorId no server.
 *
 * O que mostra:
 *  - Header com nome do colaborador + nível de acesso + estado
 *  - Resumo do contrato (titulo, partes, datas-chave)
 *  - Corpo do contrato (HTML renderizado pelo server a partir do markdown
 *    da versão activa)
 *  - Painel lateral de comentários (lista + form se tipoAcesso >= COMENTARIO)
 *  - CTA "Assinar" se tipoAcesso = ASSINATURA (Fase D activa o canvas)
 *
 * Decisão: layout standalone (sem dashboard chrome, sem session). Estamos
 * fora do `(dashboard)` group por isso o sidebar/topbar não aparece. O
 * SessionProvider do root layout fica idle porque não há JWT.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ColaboradorTipoAcesso } from '@kamaia/shared-types'
import { fmtDate } from '@/lib/clm-format'
import { MessageSquare, Lock, FileSignature, Send, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { AssinarDrawer } from '@/components/contratos/assinar-drawer'
import { apiUrl } from '@/lib/api'

interface ContextResponse {
  colaborador: {
    id: string
    nome: string | null
    email: string
    tipoAcesso: ColaboradorTipoAcesso
  }
  contrato: {
    id: string
    numeroInterno: string
    titulo: string
    descricao: string | null
    tipo: { codigo: string; nome: string; categoria: string } | null
    estado: string
    valor: string | null
    moeda: string | null
    leiAplicavel: string | null
    foro: string | null
    dataAssinatura: string | null
    dataInicioVigencia: string | null
    dataTermo: string | null
    partes: Array<{ id: string; papel: string; entidade: { nome: string; tipo: string } }>
    versaoActual: {
      id: string
      versao: string
      corpoMarkdown: string | null
      corpoHtml: string | null
      createdAt: string
    } | null
  }
}

interface Comentario {
  id: string
  autorTipo: string
  autorNome: string | null
  texto: string
  clausulaRef: string
  resolvido: boolean
  createdAt: string
  parentComentarioId: string | null
}

export default function ColaboradorPage() {
  const { token } = useParams<{ token: string }>()
  const [ctx, setCtx] = useState<ContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    api<ContextResponse>(`/c/${token}`, { noTenant: true })
      .then((res) => {
        if (!cancelled) setCtx(res)
      })
      .catch((e: { error?: string }) => {
        if (!cancelled) setError(e?.error ?? 'Não foi possível abrir este contrato.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return <PublicShell><div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div></PublicShell>
  }

  if (error || !ctx) {
    return (
      <PublicShell>
        <div
          style={{
            background: 'var(--k2-bg-elev)',
            border: '1px solid var(--k2-border)',
            borderRadius: 'var(--k2-radius)',
            padding: 32,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Lock size={28} color="var(--k2-text-mute)" />
          <div style={{ fontSize: 16, fontWeight: 500 }}>Acesso indisponível</div>
          <div style={{ fontSize: 13, color: 'var(--k2-text-dim)', maxWidth: 380 }}>
            {error ?? 'O link pode ter expirado, sido revogado, ou estar incorrecto.'}
          </div>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <ContractView ctx={ctx} token={token} />
    </PublicShell>
  )
}

function ContractView({ ctx, token }: { ctx: ContextResponse; token: string }) {
  const podeComentar =
    ctx.colaborador.tipoAcesso === ColaboradorTipoAcesso.COMENTARIO ||
    ctx.colaborador.tipoAcesso === ColaboradorTipoAcesso.ASSINATURA
  const podeAssinar = ctx.colaborador.tipoAcesso === ColaboradorTipoAcesso.ASSINATURA
  const [signOpen, setSignOpen] = useState(false)
  const [signedOk, setSignedOk] = useState(false)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'flex-start' }}>
      <main style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Contrato {ctx.contrato.numeroInterno}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: '6px 0 0' }}>{ctx.contrato.titulo}</h1>
            {ctx.contrato.descricao && (
              <p style={{ fontSize: 14, color: 'var(--k2-text-dim)', marginTop: 8 }}>{ctx.contrato.descricao}</p>
            )}
          </div>
          <a
            href={apiUrl(`/c/${token}/pdf`)}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--k2-text-dim)',
              border: '1px solid var(--k2-border)',
              padding: '6px 12px',
              borderRadius: 'var(--k2-radius-sm)',
              textDecoration: 'none',
              background: 'var(--k2-bg-elev)',
            }}
          >
            <Download size={12} /> PDF
          </a>
        </header>

        <MetaGrid ctx={ctx} />

        <section style={{
          background: 'var(--k2-bg-elev)',
          border: '1px solid var(--k2-border)',
          borderRadius: 'var(--k2-radius)',
          padding: '24px 28px',
        }}>
          <style jsx>{`
            .corpo :global(h1) { font-size: 22px; margin: 18px 0 10px; font-weight: 600; }
            .corpo :global(h2) { font-size: 18px; margin: 16px 0 8px; font-weight: 600; }
            .corpo :global(h3) { font-size: 15px; margin: 14px 0 6px; font-weight: 600; }
            .corpo :global(p) { margin: 8px 0; line-height: 1.7; }
            .corpo :global(ul), .corpo :global(ol) { padding-left: 22px; margin: 8px 0; line-height: 1.7; }
            .corpo :global(code) { background: var(--k2-bg-elev-2); padding: 1px 5px; border-radius: 4px; font-size: 0.92em; }
            .corpo :global(a) { color: var(--k2-accent); }
            .corpo :global(pre) { background: var(--k2-bg-elev-2); padding: 12px; border-radius: 6px; overflow: auto; }
          `}</style>
          {ctx.contrato.versaoActual?.corpoHtml ? (
            <div
              className="corpo"
              dangerouslySetInnerHTML={{ __html: ctx.contrato.versaoActual.corpoHtml }}
            />
          ) : (
            <div style={{
              padding: '24px 0',
              textAlign: 'center',
              color: 'var(--k2-text-mute)',
              fontSize: 13,
            }}>
              <AlertCircle size={20} style={{ display: 'inline-block', marginBottom: 6 }} />
              <div>O corpo do contrato ainda não foi redigido.</div>
            </div>
          )}
        </section>

        {podeAssinar && ctx.contrato.versaoActual?.id && (
          <section style={{
            background: signedOk ? 'rgba(16,185,129,0.08)' : 'var(--k2-bg-elev)',
            border: `1px solid ${signedOk ? 'rgba(16,185,129,0.4)' : 'var(--k2-border)'}`,
            borderRadius: 'var(--k2-radius)',
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            {signedOk ? (
              <CheckCircle2 size={22} color="#16a34a" />
            ) : (
              <FileSignature size={22} color="var(--k2-accent)" />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {signedOk ? 'Assinatura registada' : 'Pronto para assinar?'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>
                {signedOk
                  ? 'O proprietário do contrato foi notificado.'
                  : 'Desenha a tua assinatura no canvas — fica associada à versão actual com hash do conteúdo.'}
              </div>
            </div>
            {!signedOk && (
              <Button onClick={() => setSignOpen(true)}>Assinar</Button>
            )}
          </section>
        )}

        {podeAssinar && ctx.contrato.versaoActual?.id && (
          <AssinarDrawer
            open={signOpen}
            onClose={() => setSignOpen(false)}
            token={token}
            versaoId={ctx.contrato.versaoActual.id}
            contratoTitulo={ctx.contrato.titulo}
            signatarioEmailHint={ctx.colaborador.email}
            signatarioNomeHint={ctx.colaborador.nome}
            onSigned={() => setSignedOk(true)}
          />
        )}
      </main>

      <ComentariosSidebar
        token={token}
        versaoId={ctx.contrato.versaoActual?.id ?? null}
        podeComentar={podeComentar}
      />
    </div>
  )
}

function MetaGrid({ ctx }: { ctx: ContextResponse }) {
  const items: Array<[string, string | null]> = [
    ['Tipo', ctx.contrato.tipo?.nome ?? null],
    ['Lei aplicável', ctx.contrato.leiAplicavel],
    ['Foro', ctx.contrato.foro],
    ['Início vigência', ctx.contrato.dataInicioVigencia ? fmtDate(ctx.contrato.dataInicioVigencia) : null],
    ['Data termo', ctx.contrato.dataTermo ? fmtDate(ctx.contrato.dataTermo) : null],
  ]
  const partesText = ctx.contrato.partes.map((p) => `${p.entidade.nome} (${p.papel.replaceAll('_', ' ').toLowerCase()})`).join(' · ')

  return (
    <div style={{
      background: 'var(--k2-bg-elev)',
      border: '1px solid var(--k2-border)',
      borderRadius: 'var(--k2-radius)',
      padding: 16,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 14,
    }}>
      {items.map(([label, value]) => value && (
        <div key={label}>
          <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{value}</div>
        </div>
      ))}
      {partesText && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Partes</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{partesText}</div>
        </div>
      )}
    </div>
  )
}

function ComentariosSidebar({
  token,
  versaoId,
  podeComentar,
}: {
  token: string
  versaoId: string | null
  podeComentar: boolean
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [clausula, setClausula] = useState('Geral')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fetchComentarios = async () => {
    setLoading(true)
    try {
      const data = await api<Comentario[]>(`/c/${token}/comentarios`, { noTenant: true })
      setComentarios(data ?? [])
    } catch (e) {
      setErr((e as { error?: string })?.error ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchComentarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const submit = async () => {
    if (!texto.trim()) return
    setSubmitting(true)
    setErr(null)
    try {
      await api(`/c/${token}/comentarios`, {
        method: 'POST',
        noTenant: true,
        body: JSON.stringify({
          texto: texto.trim(),
          clausulaRef: clausula.trim() || 'Geral',
          versaoId: versaoId ?? undefined,
        }),
      })
      setTexto('')
      void fetchComentarios()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao enviar comentário.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside
      style={{
        position: 'sticky',
        top: 24,
        background: 'var(--k2-bg-elev)',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxHeight: 'calc(100vh - 48px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={15} />
        <div style={{ fontSize: 13, fontWeight: 500 }}>Comentários</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>{comentarios.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ color: 'var(--k2-text-mute)', fontSize: 12 }}>A carregar…</div>
        ) : comentarios.length === 0 ? (
          <div style={{ color: 'var(--k2-text-mute)', fontSize: 12, padding: '8px 0' }}>
            {podeComentar
              ? 'Sem comentários ainda. Sê o primeiro a comentar uma cláusula.'
              : 'Sem comentários nesta versão.'}
          </div>
        ) : (
          comentarios.map((c) => (
            <div
              key={c.id}
              style={{
                background: 'var(--k2-bg)',
                border: '1px solid var(--k2-border)',
                borderRadius: 'var(--k2-radius-sm)',
                padding: '10px 12px',
                opacity: c.resolvido ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.autorNome ?? 'Anónimo'}</span>
                <Badge variant={c.autorTipo === 'COLABORADOR' ? 'info' : 'default'}>
                  {c.autorTipo === 'COLABORADOR' ? 'Externo' : 'Interno'}
                </Badge>
              </div>
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 2 }}>
                {c.clausulaRef} · {new Date(c.createdAt).toLocaleString('pt-PT')}
              </div>
              <div style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{c.texto}</div>
            </div>
          ))
        )}
      </div>

      {podeComentar ? (
        <div style={{ borderTop: '1px solid var(--k2-border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={clausula}
            onChange={(e) => setClausula(e.target.value)}
            placeholder="Cláusula (ex.: 3.2 ou Geral)"
            style={{
              background: 'var(--k2-bg)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius-sm)',
              padding: '6px 8px',
              color: 'var(--k2-text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="O teu comentário…"
            style={{
              background: 'var(--k2-bg)',
              border: '1px solid var(--k2-border)',
              borderRadius: 'var(--k2-radius-sm)',
              padding: '8px 10px',
              color: 'var(--k2-text)',
              fontSize: 13,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {err && <div style={{ color: 'var(--k2-bad)', fontSize: 11 }}>{err}</div>}
          <Button
            onClick={submit}
            disabled={!texto.trim()}
            loading={submitting}
            leftIcon={<Send size={12} />}
          >
            Enviar
          </Button>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--k2-border)', paddingTop: 10, fontSize: 11, color: 'var(--k2-text-mute)' }}>
          O teu acesso é só de leitura.
        </div>
      )}
    </aside>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--k2-bg)',
      color: 'var(--k2-text)',
      padding: '24px 28px 80px',
    }}>
      <header style={{
        maxWidth: 1240,
        margin: '0 auto 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'var(--k2-accent)',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
          }}>K</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Kamaia</div>
            <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Contract Lifecycle Management
            </div>
          </div>
        </div>
        <PublicAccessHint />
      </header>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}

function PublicAccessHint() {
  return (
    <div style={{
      fontSize: 11,
      color: 'var(--k2-text-mute)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <Lock size={11} />
      Acesso externo seguro · ligação única
    </div>
  )
}
