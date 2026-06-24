'use client'

/**
 * NovoContratoFlow — Drawer slide-over com 2 passos:
 *
 *   PASSO 1 — selector de caminho:
 *     ① Registar contrato existente (upload PDF/Word + form de metadados)
 *     ② Folha em branco com IA (cria + dispara /ia/draft-contrato)
 *     ③ A partir de template (cria + resolve placeholders server-side)
 *
 *   PASSO 2 — formulário partilhado + extras por caminho.
 *
 * O formulário shared é único para os 3 caminhos:
 *   - Identificação (título, tipo, descrição, carteira)
 *   - Partes (PartesPicker — pesquisa + quick-add inline)
 *   - Valores e datas (todos opcionais)
 *
 * Extras por caminho:
 *   ① DocumentDropzone + selector de estado inicial
 *   ② Textarea de instruções IA (opcional) + checkbox "redigir agora"
 *   ③ TemplatePicker (filtra por tipo) com preview
 *
 * Substitui NovoContratoModal — mantém a mesma assinatura externa
 * (open, onClose) para zero-impact na lista de contratos.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  FileText,
  Sparkles,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  ContratoEstado,
  MOEDAS_SUPORTADAS,
  PaginatedResponse,
} from '@kamaia/shared-types'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import {
  DocumentDropzone,
  type UploadedDocument,
} from '@/components/ui/document-dropzone'
import { PartesPicker, type ParteInput } from './partes-picker'
import { TemplatePicker } from './template-picker'

type Caminho = 'existente' | 'ia' | 'template'

interface OptionItem {
  id: string
  nome: string
}

interface MembershipUser {
  userId: string
  firstName: string
  lastName: string
}

interface MembershipResponse {
  data: MembershipUser[]
}

interface ContratoCriado {
  id: string
  numeroInterno: string
}

export function NovoContratoFlow({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { data: session, status } = useSession()

  // Passo
  const [step, setStep] = useState<1 | 2>(1)
  const [caminho, setCaminho] = useState<Caminho | null>(null)

  // Catálogos
  const [tipos, setTipos] = useState<OptionItem[]>([])
  const [carteiras, setCarteiras] = useState<OptionItem[]>([])
  const [responsaveis, setResponsaveis] = useState<MembershipUser[]>([])

  // Form shared
  const [titulo, setTitulo] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [carteiraId, setCarteiraId] = useState('')
  const [partes, setPartes] = useState<ParteInput[]>([])
  const [valor, setValor] = useState('')
  const [moeda, setMoeda] = useState('AOA')
  const [leiAplicavel, setLeiAplicavel] = useState('')
  const [foro, setForo] = useState('')
  const [dataAssinatura, setDataAssinatura] = useState('')
  const [dataInicioVigencia, setDataInicioVigencia] = useState('')
  const [dataTermo, setDataTermo] = useState('')
  const [renovacaoAutomatica, setRenovacaoAutomatica] = useState(false)
  const [prazoRenovacaoMeses, setPrazoRenovacaoMeses] = useState('')
  const [janelaDenunciaDias, setJanelaDenunciaDias] = useState('')
  const [responsavelId, setResponsavelId] = useState('')

  // Caminho ① — existente
  const [docInicial, setDocInicial] = useState<UploadedDocument | null>(null)
  const [estadoInicial, setEstadoInicial] = useState<ContratoEstado>(
    ContratoEstado.REPOSITORIO,
  )

  // Caminho ② — IA
  const [iaPrompt, setIaPrompt] = useState('')
  const [iaRedigirAgora, setIaRedigirAgora] = useState(true)

  // Caminho ③ — template
  const [templateId, setTemplateId] = useState<string | null>(null)

  // Geral
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Carrega catálogos uma vez (lazy fora do trigger do open para
  // evitar latência percebida na 1ª abertura)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    // BUG FIX: /tipos-contrato devolve array directo (não wrapped
     // em `{ data: [...] }`). Sem este fix, o dropdown ficava vazio
     // mesmo com tipos cadastrados (PaginatedResponse.data === undefined).
    Promise.all([
      api<OptionItem[] | PaginatedResponse<OptionItem>>('/tipos-contrato', { token: session.accessToken }),
      api<PaginatedResponse<OptionItem>>('/carteiras?limit=100', { token: session.accessToken }),
      api<MembershipResponse>('/memberships', { token: session.accessToken }),
    ])
      .then(([t, c, m]) => {
        // Aceita ambas as formas — defensivo contra futuras alterações
        // ao formato do endpoint.
        const tiposArr = Array.isArray(t)
          ? t
          : (t as PaginatedResponse<OptionItem>).data ?? []
        setTipos(tiposArr)
        setCarteiras(c.data ?? [])
        setResponsaveis(m.data ?? [])
      })
      .catch(() => {
        /* tolera carregamento parcial */
      })
  }, [session?.accessToken, status])

  // Reset quando fecha (mantém step=1 para next time)
  useEffect(() => {
    if (open) return
    setStep(1)
    setCaminho(null)
    setTitulo('')
    setTipoId('')
    setDescricao('')
    setCarteiraId('')
    setPartes([])
    setValor('')
    setMoeda('AOA')
    setLeiAplicavel('')
    setForo('')
    setDataAssinatura('')
    setDataInicioVigencia('')
    setDataTermo('')
    setRenovacaoAutomatica(false)
    setJanelaDenunciaDias('')
    setResponsavelId('')
    setDocInicial(null)
    setEstadoInicial(ContratoEstado.REPOSITORIO)
    setIaPrompt('')
    setIaRedigirAgora(true)
    setTemplateId(null)
    setErr(null)
  }, [open])

  // Conjunto de paths preenchidos para o TemplatePicker marcar ✓
  const pathsPresentes = useMemo(() => {
    const s = new Set<string>()
    if (titulo) s.add('titulo')
    if (descricao) s.add('descricao')
    if (valor) { s.add('valor'); s.add('moeda') }
    if (leiAplicavel) { s.add('lei'); s.add('leiAplicavel') }
    if (foro) s.add('foro')
    if (dataAssinatura) s.add('dataAssinatura')
    if (dataInicioVigencia) s.add('dataInicioVigencia')
    if (dataTermo) s.add('dataTermo')
    partes.forEach((p, i) => {
      if (p.entidadeNome) {
        s.add(`partes.${i}.nome`)
        if (p.papel === 'PARTE_PRINCIPAL') s.add('partes.principal.nome')
        if (p.papel === 'CONTRAPARTE') s.add('partes.contraparte.nome')
        if (p.papel === 'GARANTE') s.add('partes.garante.nome')
      }
    })
    return s
  }, [titulo, descricao, valor, leiAplicavel, foro, dataAssinatura, dataInicioVigencia, dataTermo, partes])

  const podeSubmeter =
    !!titulo.trim() &&
    !!tipoId &&
    (caminho !== 'existente' || !!docInicial) &&
    (caminho !== 'template' || !!templateId)

  const submit = async () => {
    if (!session?.accessToken || !caminho) return
    setSubmitting(true)
    setErr(null)
    try {
      // Converte valor para centavos BigInt (string)
      let valorCentavos: string | undefined
      if (valor) {
        const parsed = Number(valor.replace(',', '.'))
        if (Number.isFinite(parsed)) {
          valorCentavos = String(Math.round(parsed * 100))
        }
      }

      const partesPayload = partes
        .filter((p) => p.entidadeId)
        .map((p, i) => ({
          entidadeId: p.entidadeId,
          papel: p.papel,
          representanteNome: p.representanteNome || undefined,
          representanteCargo: p.representanteCargo || undefined,
          representanteBI: p.representanteBI || undefined,
          ordem: i,
        }))

      const sharedBody = {
        titulo: titulo.trim(),
        tipoId,
        descricao: descricao.trim() || undefined,
        carteiraId: carteiraId || undefined,
        valor: valorCentavos,
        moeda: moeda || undefined,
        leiAplicavel: leiAplicavel.trim() || undefined,
        foro: foro.trim() || undefined,
        dataAssinatura: dataAssinatura || undefined,
        dataInicioVigencia: dataInicioVigencia || undefined,
        dataTermo: dataTermo || undefined,
        renovacaoAutomatica,
        prazoRenovacaoMeses:
          renovacaoAutomatica && prazoRenovacaoMeses
            ? Number(prazoRenovacaoMeses)
            : undefined,
        janelaDenunciaDias: janelaDenunciaDias ? Number(janelaDenunciaDias) : undefined,
        responsavelId: responsavelId || undefined,
        partes: partesPayload.length > 0 ? partesPayload : undefined,
      }

      let criado: ContratoCriado

      if (caminho === 'existente') {
        criado = await api<ContratoCriado>('/contratos', {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify({
            ...sharedBody,
            estadoInicial,
            documentoInicialId: docInicial!.id,
          }),
        })
      } else if (caminho === 'template') {
        criado = await api<ContratoCriado>('/contratos/from-template', {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify({
            ...sharedBody,
            templateId: templateId!,
            preencherPlaceholders: true,
          }),
        })
      } else {
        // ② IA
        criado = await api<ContratoCriado>('/contratos', {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify({
            ...sharedBody,
            estadoInicial: ContratoEstado.DRAFTING,
          }),
        })

        if (iaRedigirAgora) {
          try {
            await api(`/ia/draft-contrato`, {
              method: 'POST',
              token: session.accessToken,
              body: JSON.stringify({
                contratoId: criado.id,
                prompt: iaPrompt.trim() || undefined,
                novaVersao: true,
              }),
            })
          } catch (e) {
            // Não bloqueia o fluxo — contrato foi criado, IA falhou.
            // Utilizador pode re-tentar no tab Editor.
            console.warn('Draft IA falhou após criar contrato:', e)
          }
        }
      }

      onClose()
      router.push(`/contratos/${criado.id}`)
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao criar contrato.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={920} position="center">
      <DrawerHeader
        title="Novo contrato"
        subtitle={
          step === 1
            ? 'Escolhe como queres começar'
            : caminho === 'existente'
            ? 'Registar contrato existente'
            : caminho === 'ia'
            ? 'Folha em branco — IA gera a minuta'
            : 'A partir de template'
        }
        onClose={onClose}
      />
      <DrawerBody>
        {err && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {err}
          </div>
        )}

        {step === 1 && (
          <PathSelector
            value={caminho}
            onChange={(c) => {
              setCaminho(c)
              setStep(2)
              // Caminho-specific defaults
              if (c === 'existente') setEstadoInicial(ContratoEstado.REPOSITORIO)
            }}
          />
        )}

        {step === 2 && caminho && (
          <form
            id="novo-contrato-form"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            style={{ display: 'grid', gap: 18 }}
          >
            <Section title="Identificação">
              <Field label="Título *">
                <Input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Prestação de serviços de auditoria 2026"
                  autoFocus
                />
              </Field>
              <Row>
                <Field label="Tipo de contrato *">
                  <Select required value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                    <option value="">Selecciona…</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Carteira (opcional)">
                  <Select value={carteiraId} onChange={(e) => setCarteiraId(e.target.value)}>
                    <option value="">Nenhuma</option>
                    {carteiras.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </Select>
                </Field>
              </Row>
              <Field label="Descrição">
                <Textarea
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Resumo do objecto contratual."
                />
              </Field>
            </Section>

            <Section title="Partes">
              <PartesPicker value={partes} onChange={setPartes} />
            </Section>

            <Section title="Valores e datas (opcional)">
              <Row cols="2fr 1fr">
                <Field label="Valor (em kwanzas, ex.: 150000.50)">
                  <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Moeda">
                  <Select value={moeda} onChange={(e) => setMoeda(e.target.value)}>
                    {MOEDAS_SUPORTADAS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </Field>
              </Row>
              <Row>
                <Field label="Lei aplicável">
                  <Input value={leiAplicavel} onChange={(e) => setLeiAplicavel(e.target.value)} placeholder="Ex.: Direito angolano" />
                </Field>
                <Field label="Foro">
                  <Input value={foro} onChange={(e) => setForo(e.target.value)} placeholder="Ex.: Tribunal da Comarca de Luanda" />
                </Field>
              </Row>
              <Row cols="1fr 1fr 1fr">
                <Field label="Data assinatura">
                  <Input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
                </Field>
                <Field label="Início vigência">
                  <Input type="date" value={dataInicioVigencia} onChange={(e) => setDataInicioVigencia(e.target.value)} />
                </Field>
                <Field label="Data termo">
                  <Input type="date" value={dataTermo} onChange={(e) => setDataTermo(e.target.value)} />
                </Field>
              </Row>
              <Row>
                <Field label="Janela de denúncia (dias)">
                  <Input type="number" value={janelaDenunciaDias} onChange={(e) => setJanelaDenunciaDias(e.target.value)} placeholder="Ex.: 60" />
                </Field>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--k2-text-dim)', marginTop: 22 }}>
                  <input type="checkbox" checked={renovacaoAutomatica} onChange={(e) => setRenovacaoAutomatica(e.target.checked)} />
                  Renovação automática
                </label>
              </Row>
              {renovacaoAutomatica && (
                <Row>
                  <Field
                    label="Prazo de cada renovação (meses)"
                    hint="Período do ciclo de renovação tácita. Ex.: 12 = renova por mais 1 ano."
                  >
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={prazoRenovacaoMeses}
                      onChange={(e) => setPrazoRenovacaoMeses(e.target.value)}
                      placeholder="Ex.: 12"
                    />
                  </Field>
                </Row>
              )}
              <Field label="Responsável">
                <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                  <option value="">Eu</option>
                  {responsaveis.map((u) => (
                    <option key={u.userId} value={u.userId}>{u.firstName} {u.lastName}</option>
                  ))}
                </Select>
              </Field>
            </Section>

            {/* Extras por caminho */}
            {caminho === 'existente' && (
              <Section title="Documento existente">
                <InfoBox>
                  Anexa o PDF ou Word do contrato já assinado. O ficheiro fica
                  guardado e a primeira versão do contrato aponta para ele.
                </InfoBox>
                <Field label="Ficheiro *">
                  <DocumentDropzone
                    accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                    maxMB={20}
                    attached={docInicial}
                    onUploaded={(d) => setDocInicial(d)}
                    onCleared={() => setDocInicial(null)}
                  />
                </Field>
                <Field label="Estado inicial">
                  <Select value={estadoInicial} onChange={(e) => setEstadoInicial(e.target.value as ContratoEstado)}>
                    <option value={ContratoEstado.REPOSITORIO}>Repositório (arquivo)</option>
                    <option value={ContratoEstado.ACTIVO}>Activo (já em execução)</option>
                    <option value={ContratoEstado.ASSINADO}>Assinado (recém-assinado)</option>
                  </Select>
                </Field>
              </Section>
            )}

            {caminho === 'ia' && (
              <Section title="Instruções para a IA">
                <InfoBox>
                  A IA usa o título, tipo, partes, valores, lei e foro acima
                  como base, mais cláusulas-padrão da biblioteca aprovadas no
                  tenant. Devolve o markdown — sempre revê antes de assinar.
                </InfoBox>
                <Field label="Instruções específicas (opcional)">
                  <Textarea
                    rows={4}
                    value={iaPrompt}
                    onChange={(e) => setIaPrompt(e.target.value)}
                    placeholder="Ex.: Incluir cláusula de exclusividade territorial em Luanda · Pagamento mensal a 30 dias · Indemnização de 6 meses em caso de denúncia antecipada"
                  />
                </Field>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--k2-text-dim)' }}>
                  <input
                    type="checkbox"
                    checked={iaRedigirAgora}
                    onChange={(e) => setIaRedigirAgora(e.target.checked)}
                  />
                  Redigir corpo imediatamente após criar
                </label>
              </Section>
            )}

            {caminho === 'template' && (
              <Section title="Template">
                <InfoBox>
                  Os <strong>placeholders</strong> {`{{...}}`} no template são
                  preenchidos com os dados acima. Os que ficarem por preencher
                  aparecem como{' '}
                  <code style={{ background: 'var(--k2-bg-elev-2)', padding: '0 4px', borderRadius: 3 }}>
                    [A COMPLETAR — campo]
                  </code>{' '}
                  no draft.
                </InfoBox>
                <TemplatePicker
                  tipoId={tipoId || null}
                  value={templateId}
                  onChange={(id) => setTemplateId(id)}
                  pathsPresentes={pathsPresentes}
                />
              </Section>
            )}
          </form>
        )}
      </DrawerBody>
      <DrawerFooter>
        {step === 2 && (
          <Button
            variant="secondary"
            type="button"
            onClick={() => setStep(1)}
            leftIcon={<ChevronLeft size={13} />}
          >
            Voltar
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        {step === 2 && (
          <Button
            type="submit"
            form="novo-contrato-form"
            loading={submitting}
            disabled={!podeSubmeter}
          >
            Criar contrato
          </Button>
        )}
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Path selector (step 1) ──────────────────────

function PathSelector({
  value,
  onChange,
}: {
  value: Caminho | null
  onChange: (c: Caminho) => void
}) {
  const cards: Array<{
    id: Caminho
    icon: React.ReactNode
    title: string
    desc: string
    state: string
    mode: string
  }> = [
    {
      id: 'existente',
      icon: <FileUp size={20} />,
      title: 'Registar existente',
      desc: 'Carrega o PDF / Word de um contrato já assinado ou em circulação. Útil para migrar a tua carteira legada.',
      state: 'estado: REPOSITORIO / ACTIVO',
      mode: 'Modo C',
    },
    {
      id: 'ia',
      icon: <Sparkles size={20} />,
      title: 'Folha em branco com IA',
      desc: 'Começa em branco; a IA redige o corpo com cláusulas-padrão pt-AO baseado no tipo + partes. Editas depois.',
      state: 'estado: DRAFTING',
      mode: 'Modo A',
    },
    {
      id: 'template',
      icon: <FileText size={20} />,
      title: 'A partir de template',
      desc: 'Escolhe uma minuta da biblioteca; placeholders são preenchidos com os dados do formulário.',
      state: 'estado: DRAFTING',
      mode: 'Modo A',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 16,
            background: value === c.id ? 'rgba(99,102,241,0.06)' : 'var(--k2-bg-elev)',
            border: `1px solid ${value === c.id ? 'var(--k2-accent)' : 'var(--k2-border)'}`,
            borderRadius: 'var(--k2-radius)',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--k2-text)',
            transition: 'border-color 120ms, background 120ms',
          }}
        >
          <div style={{ color: 'var(--k2-accent)' }}>{c.icon}</div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{c.title}</div>
          <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', lineHeight: 1.45, flex: 1 }}>
            {c.desc}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--k2-text-mute)', marginTop: 4 }}>
            <span>{c.state}</span>
            <span>{c.mode}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--k2-accent)' }}>
            Continuar <ChevronRight size={11} />
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Layout helpers ──────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--k2-text-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {title}
      </div>
      {children}
    </section>
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
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)' }}>{label}</span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--k2-text-mute)', lineHeight: 1.4 }}>{hint}</span>
      )}
    </label>
  )
}

function Row({ children, cols = '1fr 1fr' }: { children: React.ReactNode; cols?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12 }}>
      {children}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--k2-bg-elev-2, var(--k2-bg-elev))',
        border: '1px solid var(--k2-border)',
        borderRadius: 'var(--k2-radius-sm)',
        padding: '10px 14px',
        fontSize: 12,
        color: 'var(--k2-text-dim)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  )
}
