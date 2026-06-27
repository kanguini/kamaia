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
import { unwrapList } from '@/lib/list'
import {
  ContratoEstado,
  MOEDAS_SUPORTADAS,
  PartePapel,
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

interface ContratoCriado {
  id: string
  numeroInterno: string
}

export function NovoContratoFlow({
  open,
  onClose,
  /**
   * Pré-selecciona um dos 3 caminhos e avança directo para o step 2.
   * Usado pelo botão "Importar" da lista de contratos, que entra
   * directamente em 'existente' (registar contrato pré-existente).
   * Quando undefined, o utilizador escolhe o caminho no step 1.
   */
  presetCaminho,
  presetParte,
}: {
  open: boolean
  onClose: () => void
  presetCaminho?: Caminho
  /**
   * Pré-preenche uma parte do contrato (entidade + papel). Usado pelo
   * botão "Criar contrato" da página de detalhe de uma entidade, que
   * entra já com essa entidade como contraparte (editável no picker).
   */
  presetParte?: { entidadeId: string; entidadeNome: string }
}) {
  const router = useRouter()
  const { data: session, status } = useSession()

  // Passo — quando há presetCaminho, salta direct para step 2
  const [step, setStep] = useState<1 | 2>(presetCaminho ? 2 : 1)
  const [caminho, setCaminho] = useState<Caminho | null>(presetCaminho ?? null)

  // Quando abre/fecha e tem preset, garante state consistente
  useEffect(() => {
    if (open && presetCaminho) {
      setStep(2)
      setCaminho(presetCaminho)
    } else if (open && !presetCaminho) {
      setStep(1)
      setCaminho(null)
    }
  }, [open, presetCaminho])

  // Pré-preenche a entidade como contraparte (vindo da página de
  // detalhe de uma entidade). O papel é editável no PartesPicker.
  useEffect(() => {
    if (open && presetParte) {
      setPartes([
        {
          entidadeId: presetParte.entidadeId,
          entidadeNome: presetParte.entidadeNome,
          papel: PartePapel.CONTRAPARTE,
        },
      ])
    }
  }, [open, presetParte])

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
  // Detalhes campo-a-campo do backend (Zod superRefine).
  // Sem isto, o utilizador via apenas "VALIDATION_ERROR" sem saber
  // o que estava mal preenchido.
  const [errDetails, setErrDetails] = useState<
    Array<{ path: (string | number)[]; message: string }>
  >([])

  // Carrega catálogos uma vez (lazy fora do trigger do open para
  // evitar latência percebida na 1ª abertura)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    // /tipos-contrato e /carteiras devolvem array directo (não
     // paginado). /memberships devolve { data: [...] }. unwrapList
     // aceita ambas as formas defensivamente — uma única função
     // para todos os 3 elimina a fonte de "dropdown vazio que
     // antes mostrava algo".
    Promise.all([
      api<unknown>('/tipos-contrato', { token: session.accessToken }),
      api<unknown>('/carteiras', { token: session.accessToken }),
      api<unknown>('/memberships', { token: session.accessToken }),
    ])
      .then(([t, c, m]) => {
        setTipos(unwrapList<OptionItem>(t))
        setCarteiras(unwrapList<OptionItem>(c))
        setResponsaveis(unwrapList<MembershipUser>(m))
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
    setPrazoRenovacaoMeses('')
    setResponsavelId('')
    setDocInicial(null)
    setEstadoInicial(ContratoEstado.REPOSITORIO)
    setIaPrompt('')
    setIaRedigirAgora(true)
    setTemplateId(null)
    setErr(null)
    setErrDetails([])
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

  /**
   * Por que está o submit desactivado. Mostra-se inline ao lado
   * do botão para o utilizador saber o que falta — antes via o
   * botão grey-out sem saber porquê.
   */
  const motivoDesactivado: string | null = (() => {
    if (!titulo.trim()) return 'Indica um título.'
    if (!tipoId) return 'Escolhe um tipo de contrato.'
    if (caminho === 'existente' && !docInicial) {
      return 'Anexa o PDF ou Word do contrato.'
    }
    if (caminho === 'template' && !templateId) return 'Selecciona um template.'
    return null
  })()

  const submit = async () => {
    if (!session?.accessToken || !caminho) return
    setSubmitting(true)
    setErr(null)
    setErrDetails([])
    try {
      // Converte valor para centavos BigInt (string). O input é
      // type=number → valor já vem em formato canónico (ponto decimal,
      // sem separadores de milhar). Se for inválido/negativo, NÃO
      // descartamos em silêncio — abortamos com erro visível.
      let valorCentavos: string | undefined
      if (valor.trim()) {
        const parsed = Number(valor)
        if (!Number.isFinite(parsed) || parsed < 0) {
          setErr('Valor inválido — usa um número não-negativo (ex.: 150000.50).')
          setSubmitting(false)
          return
        }
        valorCentavos = String(Math.round(parsed * 100))
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
      const errObj = (e ?? {}) as {
        error?: string
        code?: string
        message?: string
        details?: Array<{ path?: (string | number)[]; message?: string }>
      }
      // Mensagem principal: prefere details[0].message se for validation
      // (mais útil que o code genérico "VALIDATION_ERROR").
      const firstDetail = errObj.details?.[0]?.message
      const friendly =
        errObj.code === 'VALIDATION_FAILED' && firstDetail
          ? firstDetail
          : errObj.error || errObj.message || 'Erro ao criar contrato.'
      setErr(friendly)
      setErrDetails(
        (errObj.details ?? [])
          .filter((d): d is { path: (string | number)[]; message: string } =>
            !!d?.message,
          )
          .map((d) => ({ path: d.path ?? [], message: d.message })),
      )
      // Scroll para o erro — o drawer pode estar com scroll baixo
      // depois de o user clicar Criar. Sem isto, o banner aparece
      // longe da vista e o utilizador pensa que nada aconteceu.
      setTimeout(() => {
        document
          .getElementById('novo-contrato-error')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={920}>
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
          <div
            id="novo-contrato-error"
            role="alert"
            style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              padding: '12px 14px',
              borderRadius: 'var(--k2-radius-sm)',
              fontSize: 13,
              border: '1px solid var(--k2-bad)',
            }}
          >
            <div style={{ fontWeight: 500 }}>{err}</div>
            {errDetails.length > 0 && (
              <ul
                style={{
                  margin: '8px 0 0',
                  paddingLeft: 18,
                  fontSize: 12,
                  opacity: 0.9,
                  listStyle: 'disc',
                }}
              >
                {errDetails.slice(0, 6).map((d, i) => (
                  <li key={i}>
                    <code style={{ fontSize: 11, opacity: 0.7 }}>
                      {d.path.join('.')}
                    </code>
                    {d.path.length > 0 && ': '}
                    {d.message}
                  </li>
                ))}
              </ul>
            )}
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
                  <Select required value={tipoId} onChange={(e) => setTipoId(e.target.value)} disabled={tipos.length === 0}>
                    <option value="">
                      {tipos.length === 0 ? 'Sem tipos disponíveis' : 'Selecciona…'}
                    </option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Select>
                  {tipos.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 6, lineHeight: 1.5 }}>
                      O catálogo está vazio.{' '}
                      <a
                        href="/biblioteca/tipos"
                        style={{ color: 'var(--k2-text)', textDecoration: 'underline' }}
                      >
                        Cria o primeiro tipo
                      </a>
                      {' '}para continuar.
                    </div>
                  )}
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
                  <Input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" />
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
        {step === 2 && motivoDesactivado && !submitting && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--k2-text-mute)',
              marginRight: 6,
              alignSelf: 'center',
            }}
          >
            {motivoDesactivado}
          </span>
        )}
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        {step === 2 && (
          <Button
            type="submit"
            form="novo-contrato-form"
            loading={submitting}
            disabled={!podeSubmeter}
            title={motivoDesactivado ?? undefined}
          >
            {caminho === 'existente' ? 'Importar contrato' : 'Criar contrato'}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              background: value === c.id ? 'var(--k2-bg-elev-2)' : 'var(--k2-bg-elev)',
              border: `1px solid ${value === c.id ? 'var(--k2-accent)' : 'var(--k2-border)'}`,
              borderRadius: 'var(--k2-radius)',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--k2-text)',
              transition: 'border-color 120ms, background 120ms',
            }}
          >
            <div style={{ color: 'var(--k2-text-dim)' }}>{c.icon}</div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: 'var(--k2-text-dim)', lineHeight: 1.45, flex: 1 }}>
              {c.desc}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--k2-text-mute)', marginTop: 4 }}>
              <span>{c.state}</span>
              <span>{c.mode}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--k2-text)' }}>
              Continuar <ChevronRight size={11} />
            </div>
          </button>
        ))}
      </div>

      {/* Importação em massa — para carteiras legadas com vários
          contratos. Navega para a página dedicada com CSV/ZIP. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'var(--k2-bg-elev)',
          border: '1px dashed var(--k2-border)',
          borderRadius: 'var(--k2-radius-sm)',
          fontSize: 12,
          color: 'var(--k2-text-dim)',
        }}
      >
        <span style={{ flex: 1 }}>
          Tens muitos contratos para migrar de uma vez?
        </span>
        <a
          href="/importacao"
          style={{
            color: 'var(--k2-text)',
            textDecoration: 'underline',
            fontWeight: 500,
          }}
        >
          Importação em massa (CSV / ZIP) →
        </a>
      </div>
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
