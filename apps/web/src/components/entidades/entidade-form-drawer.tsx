'use client'

/**
 * EntidadeFormDrawer — formulário completo de criação/edição.
 *
 * Cobertura legal mínima (Direito Angolano):
 *  - Pessoa Singular: estado civil + regime de bens (Cód. Civil
 *    arts. 1678ss exigem consentimento do cônjuge em alienação de
 *    bens comuns) + profissão + dados BI
 *  - Pessoa Colectiva: forma jurídica (Lei 1/04 sociedades comerciais),
 *    matrícula no Registo Comercial, capital social, objecto social,
 *    data de constituição, representante legal com BI/cargo
 *  - Ambos: morada estruturada (rua, município, província, país)
 *
 * Bug fix "criar não aparece":
 *  - Erros do backend ficam em banner sticky no topo do Drawer
 *  - Submit chama `onCreated` apenas se o backend retornou entidade
 *    válida com `id`
 *  - O caller deve fazer refetch (não optimistic insert) — mais
 *    fiável quando há filtros activos na lista
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import {
  EntidadeEstadoCivil,
  EntidadeFormaJuridica,
  EntidadeNacionalidadeCambial,
  EntidadeRegimeBens,
  EntidadeTipo,
} from '@kamaia/shared-types'
import { AlertTriangle } from 'lucide-react'

export interface EntidadeCreated {
  id: string
  nome: string
  tipo: EntidadeTipo
  nacionalidadeCambial: EntidadeNacionalidadeCambial
  nif: string | null
  email: string | null
}

const ESTADO_CIVIL_LABEL: Record<EntidadeEstadoCivil, string> = {
  [EntidadeEstadoCivil.SOLTEIRO]: 'Solteiro(a)',
  [EntidadeEstadoCivil.CASADO]: 'Casado(a)',
  [EntidadeEstadoCivil.UNIAO_DE_FACTO]: 'União de facto',
  [EntidadeEstadoCivil.DIVORCIADO]: 'Divorciado(a)',
  [EntidadeEstadoCivil.VIUVO]: 'Viúvo(a)',
  [EntidadeEstadoCivil.SEPARADO_JUDICIALMENTE]: 'Separado(a) judicialmente',
}

const REGIME_BENS_LABEL: Record<EntidadeRegimeBens, string> = {
  [EntidadeRegimeBens.COMUNHAO_GERAL]: 'Comunhão geral de bens',
  [EntidadeRegimeBens.COMUNHAO_ADQUIRIDOS]: 'Comunhão de adquiridos',
  [EntidadeRegimeBens.SEPARACAO]: 'Separação de bens',
}

const FORMA_JURIDICA_LABEL: Record<EntidadeFormaJuridica, string> = {
  [EntidadeFormaJuridica.LDA]: 'Sociedade por quotas (Lda)',
  [EntidadeFormaJuridica.SA]: 'Sociedade anónima (SA)',
  [EntidadeFormaJuridica.EI]: 'Empresário em nome individual',
  [EntidadeFormaJuridica.EIRL]: 'Estabelecimento individual de resp. limitada (EIRL)',
  [EntidadeFormaJuridica.COOPERATIVA]: 'Cooperativa',
  [EntidadeFormaJuridica.ASSOCIACAO]: 'Associação',
  [EntidadeFormaJuridica.FUNDACAO]: 'Fundação',
  [EntidadeFormaJuridica.SUCURSAL]: 'Sucursal de empresa estrangeira',
  [EntidadeFormaJuridica.ENTIDADE_PUBLICA]: 'Entidade pública',
  [EntidadeFormaJuridica.OUTRO]: 'Outro',
}

// Lista das 18 províncias de Angola
const PROVINCIAS_AO = [
  'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando-Cubango', 'Cuanza-Norte',
  'Cuanza-Sul', 'Cunene', 'Huambo', 'Huíla', 'Luanda', 'Lunda-Norte',
  'Lunda-Sul', 'Malanje', 'Moxico', 'Namibe', 'Uíge', 'Zaire',
]

export function EntidadeFormDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (e: EntidadeCreated) => void
}) {
  const { data: session } = useSession()

  // ─── Identificação ───
  const [tipo, setTipo] = useState<EntidadeTipo>(EntidadeTipo.PESSOA_COLECTIVA)
  const [nome, setNome] = useState('')
  const [nomeComercial, setNomeComercial] = useState('')
  const [nif, setNif] = useState('')

  // ─── Pessoa singular ───
  const [numeroBI, setNumeroBI] = useState('')
  const [biEmissor, setBiEmissor] = useState('')
  const [biValidoAte, setBiValidoAte] = useState('')
  const [estadoCivil, setEstadoCivil] = useState<EntidadeEstadoCivil | ''>('')
  const [regimeBens, setRegimeBens] = useState<EntidadeRegimeBens | ''>('')
  const [profissao, setProfissao] = useState('')

  // ─── Pessoa colectiva ───
  const [formaJuridica, setFormaJuridica] = useState<EntidadeFormaJuridica | ''>('')
  const [matriculaRC, setMatriculaRC] = useState('')
  const [capitalSocial, setCapitalSocial] = useState('')
  // AOA é o ISO 4217 oficial — alinhado com o resto da app.
  const [capitalSocialMoeda, setCapitalSocialMoeda] = useState('AOA')
  const [objectoSocial, setObjectoSocial] = useState('')
  const [dataConstituicao, setDataConstituicao] = useState('')
  const [sectorActividade, setSectorActividade] = useState('')

  // ─── Representante legal (colectiva) ───
  const [repNome, setRepNome] = useState('')
  const [repCargo, setRepCargo] = useState('')
  const [repBI, setRepBI] = useState('')
  const [repEmail, setRepEmail] = useState('')
  const [repTelefone, setRepTelefone] = useState('')

  // ─── Morada ───
  const [moradaRua, setMoradaRua] = useState('')
  const [moradaNumero, setMoradaNumero] = useState('')
  const [moradaBairro, setMoradaBairro] = useState('')
  const [moradaMunicipio, setMoradaMunicipio] = useState('')
  const [moradaProvincia, setMoradaProvincia] = useState('Luanda')
  const [moradaPais, setMoradaPais] = useState('AO')

  // ─── Compliance ───
  const [nacionalidadeCambial, setNacionalidadeCambial] = useState<EntidadeNacionalidadeCambial>(
    EntidadeNacionalidadeCambial.RESIDENTE,
  )
  const [isInstituicaoFinanceira, setIsInstituicaoFinanceira] = useState(false)

  const [observacoes, setObservacoes] = useState('')

  // ─── UI state ───
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorFields, setErrorFields] = useState<string[]>([])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTipo(EntidadeTipo.PESSOA_COLECTIVA)
      setNome(''); setNomeComercial(''); setNif('')
      setNumeroBI(''); setBiEmissor(''); setBiValidoAte('')
      setEstadoCivil(''); setRegimeBens(''); setProfissao('')
      setFormaJuridica(''); setMatriculaRC(''); setCapitalSocial('')
      setCapitalSocialMoeda('AOA'); setObjectoSocial(''); setDataConstituicao('')
      setSectorActividade('')
      setRepNome(''); setRepCargo(''); setRepBI(''); setRepEmail(''); setRepTelefone('')
      setMoradaRua(''); setMoradaNumero(''); setMoradaBairro('')
      setMoradaMunicipio(''); setMoradaProvincia('Luanda'); setMoradaPais('AO')
      setNacionalidadeCambial(EntidadeNacionalidadeCambial.RESIDENTE)
      setIsInstituicaoFinanceira(false)
      setObservacoes('')
      setError(null); setErrorFields([])
    }
  }, [open])

  const isSingular = tipo === EntidadeTipo.PESSOA_SINGULAR
  const isColectiva = tipo === EntidadeTipo.PESSOA_COLECTIVA

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.accessToken) return
    setSubmitting(true)
    setError(null)
    setErrorFields([])

    // Constrói o body — só envia campos preenchidos para evitar
    // que `undefined` se transforme em string vazia no servidor.
    const morada =
      moradaRua || moradaMunicipio || moradaProvincia
        ? {
            rua: moradaRua || undefined,
            numero: moradaNumero || undefined,
            bairro: moradaBairro || undefined,
            municipio: moradaMunicipio || undefined,
            provincia: moradaProvincia || undefined,
            pais: moradaPais || 'AO',
          }
        : undefined

    const body: Record<string, unknown> = {
      tipo,
      nome,
      nacionalidadeCambial,
      paisResidencia: moradaPais || 'AO',
    }
    if (nomeComercial) body.nomeComercial = nomeComercial
    if (nif) body.nif = nif
    if (morada) body.morada = morada
    if (isInstituicaoFinanceira) body.isInstituicaoFinanceira = true
    if (observacoes) body.observacoes = observacoes

    if (isSingular) {
      if (numeroBI) body.numeroBI = numeroBI
      if (biEmissor) body.biEmissor = biEmissor
      if (biValidoAte) body.biValidoAte = biValidoAte
      if (estadoCivil) body.estadoCivil = estadoCivil
      if (regimeBens && estadoCivil === EntidadeEstadoCivil.CASADO) {
        body.regimeBens = regimeBens
      }
      if (profissao) body.profissao = profissao
    }

    if (isColectiva) {
      if (formaJuridica) body.formaJuridica = formaJuridica
      if (matriculaRC) body.matriculaRC = matriculaRC
      if (capitalSocial) {
        body.capitalSocial = Number(capitalSocial)
        body.capitalSocialMoeda = capitalSocialMoeda
      }
      if (objectoSocial) body.objectoSocial = objectoSocial
      if (dataConstituicao) body.dataConstituicao = dataConstituicao
      if (sectorActividade) body.sectorActividade = sectorActividade
      if (repNome) {
        body.representante = {
          nome: repNome,
          cargo: repCargo || undefined,
          bi: repBI || undefined,
          email: repEmail || undefined,
          telefone: repTelefone || undefined,
        }
      }
    }

    try {
      const created = await api<EntidadeCreated>('/entidades', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify(body),
      })
      if (!created || !created.id) {
        throw new Error('Resposta inválida do servidor (sem id).')
      }
      onCreated(created)
    } catch (err: unknown) {
      // Erros do backend chegam como { error, code, details? }
      const e = err as {
        error?: string
        message?: string
        details?: { path?: (string | number)[]; message?: string }[]
      }
      const msg = e.error || e.message || 'Erro a criar entidade.'
      setError(msg)
      // Path dos issues Zod — destaca campos com erro
      const fields = (e.details ?? [])
        .map((d) => (d.path ?? []).join('.'))
        .filter(Boolean)
      setErrorFields(fields)
      // Scroll erro para a vista (drawer pode estar com scroll baixo)
      setTimeout(() => {
        document.getElementById('entidade-form-error')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 50)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={680}>
      <DrawerHeader
        title="Nova entidade"
        subtitle={
          isSingular
            ? 'Pessoa singular — dados mínimos exigidos pela lei angolana.'
            : 'Pessoa colectiva — razão social, NIF, sede e representante legal.'
        }
        onClose={onClose}
      />
      <DrawerBody>
        {error && (
          <div
            id="entidade-form-error"
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
            <div>
              <div style={{ fontWeight: 500 }}>{error}</div>
              {errorFields.length > 0 && (
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                  Campos com erro: {errorFields.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        <form id="entidade-form" onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
          {/* ───────── Identificação ───────── */}
          <Section title="Identificação">
            <Field label="Tipo *">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as EntidadeTipo)}>
                <option value={EntidadeTipo.PESSOA_COLECTIVA}>Pessoa colectiva</option>
                <option value={EntidadeTipo.PESSOA_SINGULAR}>Pessoa singular</option>
              </Select>
            </Field>
            <Field label={isSingular ? 'Nome completo *' : 'Razão social *'} hint={isSingular ? 'Tal como consta no BI/Passaporte.' : 'Designação registada na Conservatória.'}>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus
                style={errorFields.includes('nome') ? errorInputStyle : undefined}
              />
            </Field>
            {isColectiva && (
              <Field label="Nome comercial (opcional)" hint="Marca, se diferente da razão social.">
                <Input value={nomeComercial} onChange={(e) => setNomeComercial(e.target.value)} />
              </Field>
            )}
            <Row>
              <Field label="NIF" hint={nacionalidadeCambial === EntidadeNacionalidadeCambial.RESIDENTE ? '10 dígitos.' : '6-15 chars alfanuméricos.'}>
                <Input value={nif} onChange={(e) => setNif(e.target.value)} style={errorFields.includes('nif') ? errorInputStyle : undefined} />
              </Field>
              <Field label="Residência cambial *">
                <Select
                  value={nacionalidadeCambial}
                  onChange={(e) => setNacionalidadeCambial(e.target.value as EntidadeNacionalidadeCambial)}
                >
                  <option value={EntidadeNacionalidadeCambial.RESIDENTE}>Residente</option>
                  <option value={EntidadeNacionalidadeCambial.NAO_RESIDENTE}>Não-residente</option>
                </Select>
              </Field>
            </Row>
          </Section>

          {/* ───────── Pessoa singular ───────── */}
          {isSingular && (
            <Section title="Dados pessoais">
              <Row>
                <Field label="Número de BI / Passaporte">
                  <Input value={numeroBI} onChange={(e) => setNumeroBI(e.target.value)} />
                </Field>
                <Field label="Profissão">
                  <Input value={profissao} onChange={(e) => setProfissao(e.target.value)} />
                </Field>
              </Row>
              <Row>
                <Field label="Emissor do BI">
                  <Input value={biEmissor} onChange={(e) => setBiEmissor(e.target.value)} placeholder="ex.: SME Luanda" />
                </Field>
                <Field label="Validade do BI">
                  <Input type="date" value={biValidoAte} onChange={(e) => setBiValidoAte(e.target.value)} />
                </Field>
              </Row>
              <Row>
                <Field label="Estado civil">
                  <Select value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value as EntidadeEstadoCivil | '')}>
                    <option value="">—</option>
                    {Object.values(EntidadeEstadoCivil).map((v) => (
                      <option key={v} value={v}>{ESTADO_CIVIL_LABEL[v]}</option>
                    ))}
                  </Select>
                </Field>
                {estadoCivil === EntidadeEstadoCivil.CASADO && (
                  <Field label="Regime de bens" hint="Cód. Civil arts. 1678ss.">
                    <Select value={regimeBens} onChange={(e) => setRegimeBens(e.target.value as EntidadeRegimeBens | '')}>
                      <option value="">—</option>
                      {Object.values(EntidadeRegimeBens).map((v) => (
                        <option key={v} value={v}>{REGIME_BENS_LABEL[v]}</option>
                      ))}
                    </Select>
                  </Field>
                )}
              </Row>
            </Section>
          )}

          {/* ───────── Pessoa colectiva ───────── */}
          {isColectiva && (
            <>
              <Section title="Constituição">
                <Row>
                  <Field label="Forma jurídica" hint="Lei 1/04 — sociedades comerciais.">
                    <Select value={formaJuridica} onChange={(e) => setFormaJuridica(e.target.value as EntidadeFormaJuridica | '')}>
                      <option value="">—</option>
                      {Object.values(EntidadeFormaJuridica).map((v) => (
                        <option key={v} value={v}>{FORMA_JURIDICA_LABEL[v]}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Matrícula CRC" hint="Conservatória do Registo Comercial.">
                    <Input value={matriculaRC} onChange={(e) => setMatriculaRC(e.target.value)} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Data de constituição">
                    <Input type="date" value={dataConstituicao} onChange={(e) => setDataConstituicao(e.target.value)} />
                  </Field>
                  <Field label="Sector de actividade">
                    <Input value={sectorActividade} onChange={(e) => setSectorActividade(e.target.value)} placeholder="ex.: Imobiliário" />
                  </Field>
                </Row>
                <Row>
                  <Field label="Capital social">
                    <Input type="number" min="0" step="0.01" value={capitalSocial} onChange={(e) => setCapitalSocial(e.target.value)} placeholder="ex.: 2000000" />
                  </Field>
                  <Field label="Moeda">
                    <Select value={capitalSocialMoeda} onChange={(e) => setCapitalSocialMoeda(e.target.value)}>
                      <option value="AOA">AOA (Kwanza)</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </Select>
                  </Field>
                </Row>
                <Field label="Objecto social" hint="Resumo da actividade conforme escritura.">
                  <textarea
                    value={objectoSocial}
                    onChange={(e) => setObjectoSocial(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    style={textareaStyle}
                  />
                </Field>
              </Section>

              <Section title="Representante legal" hint="Quem assina em nome da entidade — obrigatório por prática contratual.">
                <Field label="Nome">
                  <Input value={repNome} onChange={(e) => setRepNome(e.target.value)} placeholder="Nome do representante" />
                </Field>
                <Row>
                  <Field label="Cargo">
                    <Input value={repCargo} onChange={(e) => setRepCargo(e.target.value)} placeholder="ex.: Administrador" />
                  </Field>
                  <Field label="BI">
                    <Input value={repBI} onChange={(e) => setRepBI(e.target.value)} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Email">
                    <Input type="email" value={repEmail} onChange={(e) => setRepEmail(e.target.value)} />
                  </Field>
                  <Field label="Telefone">
                    <Input value={repTelefone} onChange={(e) => setRepTelefone(e.target.value)} />
                  </Field>
                </Row>
              </Section>
            </>
          )}

          {/* ───────── Morada ───────── */}
          <Section title={isColectiva ? 'Sede social' : 'Domicílio'}>
            <Row>
              <Field label="Rua / Avenida">
                <Input value={moradaRua} onChange={(e) => setMoradaRua(e.target.value)} />
              </Field>
              <Field label="Número">
                <Input value={moradaNumero} onChange={(e) => setMoradaNumero(e.target.value)} />
              </Field>
            </Row>
            <Row>
              <Field label="Bairro">
                <Input value={moradaBairro} onChange={(e) => setMoradaBairro(e.target.value)} />
              </Field>
              <Field label="Município">
                <Input value={moradaMunicipio} onChange={(e) => setMoradaMunicipio(e.target.value)} />
              </Field>
            </Row>
            <Row>
              <Field label="Província">
                <Select value={moradaProvincia} onChange={(e) => setMoradaProvincia(e.target.value)}>
                  {PROVINCIAS_AO.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </Field>
              <Field label="País">
                <Select value={moradaPais} onChange={(e) => setMoradaPais(e.target.value)}>
                  <option value="AO">Angola</option>
                  <option value="PT">Portugal</option>
                  <option value="BR">Brasil</option>
                  <option value="ZA">África do Sul</option>
                  <option value="CN">China</option>
                  <option value="US">EUA</option>
                </Select>
              </Field>
            </Row>
          </Section>

          {/* ───────── Compliance ───────── */}
          <Section title="Compliance">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={isInstituicaoFinanceira}
                onChange={(e) => setIsInstituicaoFinanceira(e.target.checked)}
              />
              <span>É instituição financeira (banco, seguradora, leasing, microfinanças)</span>
            </label>
            <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
              Activa regras BNA específicas no Compliance Engine.
            </div>
          </Section>

          <Section title="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Notas internas (não aparece em contratos)."
              style={textareaStyle}
            />
          </Section>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--k2-text-mute)' }}>
          Campos com <strong>*</strong> são obrigatórios.
        </div>
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="entidade-form" loading={submitting}>Criar entidade</Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ─── Helpers visuais ─────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--k2-text-mute)', margin: 0 }}>
          {title}
        </h3>
        {hint && (
          <span style={{ fontSize: 11, color: 'var(--k2-text-dim)' }}>{hint}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
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
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--k2-text-dim)' }}>{label}</span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--k2-text-mute)', lineHeight: 1.4 }}>{hint}</span>
      )}
    </label>
  )
}

const errorInputStyle: React.CSSProperties = {
  borderColor: 'rgba(239, 68, 68, 0.6)',
  boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.3)',
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
