import type { Metadata } from 'next'
import Link from 'next/link'
import {
  LayoutDashboard,
  Briefcase,
  Scale,
  Clock,
  Users,
  Receipt,
  Timer,
  Calendar,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { appUrl } from '@/lib/utm'

export const metadata: Metadata = {
  title: 'Funcionalidades',
  description:
    'Dashboard executivo, processos, prazos, clientes, facturação, timesheets, agenda, documentos e IA assistente — tudo num só fluxo pensado para gabinetes jurídicos.',
}

interface Module {
  icon: typeof Briefcase
  eyebrow: string
  title: string
  subtitle: string
  bullets: string[]
}

const MODULES: Module[] = [
  {
    icon: LayoutDashboard,
    eyebrow: 'Dashboard executivo',
    title: 'Tudo o que interessa, num só ecrã.',
    subtitle:
      'Facturação, horas, capacidade, calendário e alertas críticos. A primeira coisa que vês de manhã.',
    bullets: [
      'KPIs financeiros do mês (facturado, em dívida, WIP)',
      'Anel de capacidade — horas facturáveis vs. meta',
      'Agenda do mês com sinalizadores urgente / prazo / evento',
      'Saúde dos projectos activos',
    ],
  },
  {
    icon: Briefcase,
    eyebrow: 'Projectos',
    title: 'Carteiras de trabalho, não só casos isolados.',
    subtitle:
      'Agrupa vários processos sob um mandato, mantém equipa, budget e marcos num só lugar.',
    bullets: [
      'Workflows adaptáveis: Litígio, M&A, Compliance, Consultoria',
      'Milestones com burn-down automático',
      'Pick & detach de processos sem duplicar dados',
      'Membros, gestor e sponsor com RBAC',
    ],
  },
  {
    icon: Scale,
    eyebrow: 'Processos',
    title: 'Cada tipo tem o seu fluxo.',
    subtitle:
      'Civil, penal, laboral, administrativo, M&A, compliance. Fases pré-configuradas que podes editar.',
    bullets: [
      'Timeline com anexos, partes e intervenções',
      'Número oficial do tribunal + contraparte',
      'Estado + prioridade + fase como sinalizadores coloridos',
      'Associação a projecto opcional',
    ],
  },
  {
    icon: Clock,
    eyebrow: 'Prazos',
    title: 'Impossível esquecer um prazo.',
    subtitle:
      'Cálculo automático em dias úteis com suporte a feriados nacionais. Alertas em 3 canais antes das datas críticas.',
    bullets: [
      'Alertas 7d / 3d / 1d via email, SMS e push',
      'Tipos: contestação, recurso, resposta, alegações, audiência',
      'Estado: pendente / cumprido / expirado / cancelado',
      'Ligação directa ao processo e peças associadas',
    ],
  },
  {
    icon: Users,
    eyebrow: 'Clientes & Portal',
    title: 'CRM leve + portal do cliente.',
    subtitle:
      'O gabinete tem um CRM. O cliente tem acesso aos seus processos 24/7 sem telefonar.',
    bullets: [
      'Individual ou Empresa com NIF / número de contribuinte',
      'Contactos, endereço, cartas de nomeação',
      'Portal com processos, documentos e facturas próprias',
      'Histórico de comunicação',
    ],
  },
  {
    icon: Receipt,
    eyebrow: 'Facturação',
    title: 'De timesheets a PDF em segundos.',
    subtitle:
      'Agrega horas facturáveis e despesas por cliente ou processo. Gera factura profissional pronta a enviar.',
    bullets: [
      'Moeda configurável com formatação local correcta',
      'Estados: rascunho, enviada, parcial, paga, vencida, anulada',
      'PDF com o logotipo do gabinete e cabeçalho legal',
      'KPIs de facturação em tempo real',
    ],
  },
  {
    icon: Timer,
    eyebrow: 'Timesheets & Despesas',
    title: 'Todas as horas contam.',
    subtitle:
      'Timer dentro do processo ou entrada manual. Aprovação por gestor. Nada escapa.',
    bullets: [
      'Timer com pausa e retoma por processo',
      'Horas facturáveis vs. não-facturáveis',
      'Despesas com anexo de recibo',
      'Relatórios por utilizador, cliente, projecto',
    ],
  },
  {
    icon: Calendar,
    eyebrow: 'Agenda',
    title: 'Uma agenda, não várias.',
    subtitle:
      'Prazos, audiências, reuniões e tarefas num só calendário. Todos com acesso partilhado do gabinete.',
    bullets: [
      'Visualização mensal, semanal e diária',
      'Sincronização com Google Calendar (roadmap Q3 2026)',
      'Eventos recorrentes',
      'Associação a processos e clientes',
    ],
  },
  {
    icon: FileText,
    eyebrow: 'Documentos',
    title: 'Repositório jurídico organizado.',
    subtitle:
      'Upload, versionamento, categorização. Tudo associado ao processo ou ao cliente certo.',
    bullets: [
      'Categorias: petição, contrato, procuração, sentença, parecer',
      'Formatos: PDF, Word, Excel, imagens',
      'Limite 50 MB por ficheiro',
      'Pesquisa full-text (roadmap)',
    ],
  },
  {
    icon: Sparkles,
    eyebrow: 'IA Assistente',
    title: 'Redige peças a partir do contexto.',
    subtitle:
      'O assistente conhece os teus processos e os teus clientes. Poupa horas de digitação.',
    bullets: [
      'Redacção de petições, contratos, cartas',
      'Resumos executivos de processos longos',
      'Pesquisa jurisprudencial guiada',
      'Privado — o teu gabinete, o teu contexto',
    ],
  },
]

export default function FuncionalidadesPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="border-b border-white/5 bg-black py-24 text-white">
          <div className="shell">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Funcionalidades
              </span>
              <h1 className="mt-3 max-w-3xl text-[clamp(36px,5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
                Tudo o que um gabinete precisa,
                <br />
                <span style={{ color: '#9cb6ff' }}>num só fluxo coerente.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/75">
                10 módulos que se comunicam entre si. Registas as horas uma
                vez — aparecem no processo, na factura, no relatório e no
                portal do cliente.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Modules */}
        <div className="bg-black text-white">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={0}>
              <section
                className={
                  'border-b border-white/5 py-20 ' +
                  (i % 2 === 1 ? 'bg-white/[0.015]' : '')
                }
              >
                <div
                  className={
                    'shell grid items-center gap-12 lg:grid-cols-2 ' +
                    (i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : '')
                  }
                >
                  <div>
                    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#4a7dff]/30 bg-gradient-to-br from-[#4a7dff]/20 to-[#4a7dff]/5">
                      <m.icon size={20} style={{ color: '#9cb6ff' }} />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-white/55">
                      {m.eyebrow}
                    </span>
                    <h2 className="mt-2 text-[clamp(24px,3vw,36px)] font-medium leading-[1.12] tracking-[-0.02em]">
                      {m.title}
                    </h2>
                    <p className="mt-4 max-w-md text-white/70 leading-relaxed">
                      {m.subtitle}
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {m.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm text-white/80">
                          <CheckCircle2
                            size={15}
                            className="mt-0.5 flex-shrink-0 text-[#6be49a]"
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ModuleVisual index={i} />
                </div>
              </section>
            </Reveal>
          ))}
        </div>

        {/* CTA */}
        <section className="bg-black py-24 text-white">
          <div className="shell text-center">
            <h2 className="mx-auto max-w-2xl text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.15] tracking-[-0.02em]">
              Pronto para experimentar?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/70">
              14 dias grátis. Não precisa de cartão.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={appUrl('/register', 'features_cta')}
                className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
              >
                Começar grátis
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Agendar demo
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

// Stylised placeholder until real screenshots land. Swap for <Image> from
// public/screens/ when scripts/capture-screenshots.ts runs in CI.
function ModuleVisual({ index }: { index: number }) {
  const tones = ['#4a7dff', '#6be49a', '#e4b86b', '#e46b7a']
  const color = tones[index % tones.length]
  return (
    <div
      className="relative aspect-[4/3] rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(400px 300px at 70% 30%, ${color}22, transparent 60%)`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="space-y-2">
          {[0, 1, 2, 3].map((r) => (
            <div
              key={r}
              className="h-3 rounded-full bg-white/10"
              style={{ width: 180 + r * 40 }}
            />
          ))}
        </div>
      </div>
      <div
        className="absolute right-4 bottom-4 h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }}
      />
    </div>
  )
}
