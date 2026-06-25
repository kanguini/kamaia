'use client'

/**
 * SaveClausulaDrawer — grava selecção do editor como cláusula
 * reutilizável na biblioteca do tenant.
 *
 * Pré-preenche título, categoria sugerida pelo primeiro heading
 * markdown da selecção, e tipoContratoCodigos com o código do tipo
 * do contrato actual.
 *
 * Sintaxe defensável: o utilizador revê antes de gravar. A cláusula
 * vai `isApproved=false` por defeito; ADMIN/LEGAL_LEAD aprova no
 * módulo Biblioteca depois.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Tag, Plus, X } from 'lucide-react'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'

const CATEGORIAS = [
  'OBJECTO',
  'PRECO',
  'PRAZO',
  'OBRIGACOES',
  'CONFIDENCIALIDADE',
  'DADOS_PESSOAIS',
  'PROPRIEDADE_INTELECTUAL',
  'LIMITACAO_RESPONSABILIDADE',
  'RESOLUCAO',
  'FORCA_MAIOR',
  'LEI_APLICAVEL',
  'FORO',
  'COMUNICACOES',
  'CESSAO',
  'ALTERACOES',
  'INVALIDADE',
  'INTEGRALIDADE',
  'NAO_CONCORRENCIA',
  'EXCLUSIVIDADE',
  'OUTRO',
]

interface TipoOpt {
  id: string
  codigo: string
  nome: string
}

export function SaveClausulaDrawer({
  open,
  onClose,
  textoSelecionado,
  contratoId,
  tipoContratoCodigo,
}: {
  open: boolean
  onClose: () => void
  /** Texto seleccionado pelo utilizador no editor. */
  textoSelecionado: string
  contratoId: string
  /** Código do TipoContrato do contrato actual — pré-popula codigos. */
  tipoContratoCodigo?: string
}) {
  const { data: session } = useSession()
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('OUTRO')
  const [conteudo, setConteudo] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [codigos, setCodigos] = useState<string[]>([])
  const [tipos, setTipos] = useState<TipoOpt[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Pré-preencher quando abrir
  useEffect(() => {
    if (!open) return
    setErr(null)
    setConteudo(textoSelecionado.trim())
    // Tentar extrair título do primeiro heading
    const firstHeading = textoSelecionado.match(/^#{1,6}\s+(.+)$/m)
    if (firstHeading) {
      setTitulo(firstHeading[1].trim().slice(0, 200))
      // Sugerir categoria pelo título
      const guess = guessCategoria(firstHeading[1])
      if (guess) setCategoria(guess)
    } else {
      const firstLine = textoSelecionado.split('\n')[0].trim()
      setTitulo(firstLine.slice(0, 200))
    }
    setTags([])
    setCodigos(tipoContratoCodigo ? [tipoContratoCodigo] : [])
  }, [open, textoSelecionado, tipoContratoCodigo])

  // Carregar tipos para o picker
  useEffect(() => {
    if (!open || !session?.accessToken) return
    // /tipos-contrato devolve array directo — usar unwrapList para
     // evitar dropdown silenciosamente vazio.
    api<unknown>('/tipos-contrato', { token: session.accessToken })
      .then((r) => setTipos(unwrapList<TipoOpt>(r)))
      .catch(() => setTipos([]))
  }, [open, session?.accessToken])

  const addTag = () => {
    const t = tagInput.trim().toUpperCase()
    if (!t || tags.includes(t)) {
      setTagInput('')
      return
    }
    setTags([...tags, t])
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const toggleCodigo = (cod: string) => {
    setCodigos((prev) =>
      prev.includes(cod) ? prev.filter((c) => c !== cod) : [...prev, cod],
    )
  }

  const submit = async () => {
    if (!session?.accessToken) return
    if (!titulo.trim()) { setErr('Título obrigatório.'); return }
    if (conteudo.trim().length < 5) { setErr('Conteúdo demasiado curto.'); return }
    setSubmitting(true)
    setErr(null)
    try {
      await api('/clausulas', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          titulo: titulo.trim(),
          categoria,
          conteudo: conteudo.trim(),
          tags,
          tipoContratoCodigos: codigos,
          origemContratoId: contratoId,
        }),
      })
      onClose()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao gravar cláusula.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={600}>
      <DrawerHeader
        title="Salvar como cláusula"
        subtitle="Adiciona à biblioteca para reutilizar em contratos futuros. Aguarda aprovação do LEGAL_LEAD."
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}
        <form id="save-clausula-form" onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 14 }}>
          <Field label="Título *">
            <Input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Confidencialidade (5 anos pós-cessação)" autoFocus />
          </Field>
          <Field label="Categoria *">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
              ))}
            </Select>
          </Field>
          <Field label="Conteúdo *">
            <Textarea
              rows={8}
              required
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              style={{ fontFamily: 'var(--k2-font-mono, monospace)', fontSize: 12 }}
            />
          </Field>
          <Field label="Tipos de contrato aplicáveis">
            {tipos.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginBottom: 6, lineHeight: 1.5 }}>
                Catálogo vazio.{' '}
                <a href="/biblioteca/tipos" style={{ color: 'var(--k2-text)', textDecoration: 'underline' }}>
                  Cria o primeiro tipo
                </a>
                . Cláusulas sem tipos ficam transversais.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tipos.map((t) => {
                const active = codigos.includes(t.codigo)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleCodigo(t.codigo)}
                    style={{
                      padding: '4px 9px',
                      fontSize: 11,
                      background: active ? 'rgba(99,102,241,0.10)' : 'var(--k2-bg-elev)',
                      border: `1px solid ${active ? 'var(--k2-accent)' : 'var(--k2-border)'}`,
                      color: active ? 'var(--k2-accent)' : 'var(--k2-text-dim)',
                      borderRadius: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {t.codigo}
                  </button>
                )
              })}
            </div>
            <small style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
              Vazio = aplicável a todos os tipos (transversal).
            </small>
          </Field>
          <Field label="Tags">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag() }
                }}
                placeholder="Adicionar tag (Enter)"
                style={{ width: 200 }}
              />
              <button type="button" onClick={addTag} style={{ background: 'transparent', border: '1px solid var(--k2-border)', color: 'var(--k2-text-dim)', padding: '6px 10px', borderRadius: 'var(--k2-radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Plus size={11} /> Adicionar
              </button>
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {tags.map((t) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--k2-bg-elev-2, var(--k2-bg-elev))', border: '1px solid var(--k2-border)', borderRadius: 12, padding: '2px 8px', color: 'var(--k2-text)' }}>
                    <Tag size={10} /> {t}
                    <button type="button" onClick={() => removeTag(t)} style={{ background: 'transparent', border: 'none', color: 'var(--k2-text-mute)', cursor: 'pointer', padding: 0 }}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="save-clausula-form" loading={submitting}>Gravar</Button>
      </DrawerFooter>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
      {label}
      {children}
    </label>
  )
}

function guessCategoria(title: string): string | null {
  const t = title.toLowerCase()
  if (/objecto|objeto/.test(t)) return 'OBJECTO'
  if (/preço|preco|valor|pagamento/.test(t)) return 'PRECO'
  if (/prazo|vigência|vigencia|duração/.test(t)) return 'PRAZO'
  if (/obrigaç|obrigac/.test(t)) return 'OBRIGACOES'
  if (/confidencialidade|sigilo/.test(t)) return 'CONFIDENCIALIDADE'
  if (/dados pessoais/.test(t)) return 'DADOS_PESSOAIS'
  if (/propriedade intelectual|ip|copyright/.test(t)) return 'PROPRIEDADE_INTELECTUAL'
  if (/limitação|limitacao.*responsab/.test(t)) return 'LIMITACAO_RESPONSABILIDADE'
  if (/resoluç|resoluc|denúncia|denuncia|rescisão|rescisao/.test(t)) return 'RESOLUCAO'
  if (/força maior|forca maior/.test(t)) return 'FORCA_MAIOR'
  if (/lei aplicável|lei aplicavel/.test(t)) return 'LEI_APLICAVEL'
  if (/foro|arbitragem/.test(t)) return 'FORO'
  if (/comunicações|comunicacoes/.test(t)) return 'COMUNICACOES'
  if (/cessão|cessao/.test(t)) return 'CESSAO'
  if (/não concorrência|nao concorrencia/.test(t)) return 'NAO_CONCORRENCIA'
  if (/exclusividade/.test(t)) return 'EXCLUSIVIDADE'
  if (/alteraç|alterac/.test(t)) return 'ALTERACOES'
  if (/invalidade/.test(t)) return 'INVALIDADE'
  if (/integralidade|acordo integral/.test(t)) return 'INTEGRALIDADE'
  return null
}
