import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FileText,
  Workflow,
  ShieldCheck,
  Bot,
  Boxes,
  Library,
  Inbox,
  Building2,
  CalendarClock,
  Banknote,
  Network,
  Lock,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { appUrl } from '@/lib/utm'

export const metadata: Metadata = {
  title: 'Funcionalidades · Kamaia CLM',
  description:
    'O ciclo de vida completo do contrato — redacção, negociação, assinatura, vida activa e terminação — com compliance angolano embebido e um conselheiro de IA sobre a legislação local.',
  alternates: { canonical: '/funcionalidades' },
  openGraph: {
    title: 'Funcionalidades · Kamaia CLM',
    description:
      'Tudo o que uma organização angolana precisa para gerir contratos: ciclo de vida, compliance, biblioteca, IA e importação da carteira existente.',
  },
}

const CAPACIDADES = [
  {
    icon: Workflow,
    title: 'Ciclo de vida, de ponta a ponta',
    body:
      'Da solicitação ao arquivo, passando por redacção, revisão, negociação, aprovação, assinatura, vida activa, adendas e terminação. Cada contrato tem um estado claro, transições validadas e uma cronologia imutável. A página adapta-se à fase — o que é editável, o que está em vigor, o que aguarda decisão.',
  },
  {
    icon: Boxes,
    title: 'Herança da carteira existente',
    body:
      'Traga os contratos que já tem — PDF, Word ou digitalizações. A extracção assistida lê partes, datas-chave e valor de cada um, e a sua equipa confirma antes de publicar. Herdar um contrato é tão sólido quanto criá-lo de raiz; é por aí que a maioria das organizações começa.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance angolano embebido',
    body:
      'Imposto de Selo, registos públicos (Predial, Comercial, Automóvel, IAPI), BNA e Lei Cambial, retenção AGT sobre serviços de não-residentes, e reconhecimento notarial. O motor sugere os actos aplicáveis com o prazo legal e a referência ao diploma vigente à data do facto — a sua equipa confirma cada um.',
  },
  {
    icon: Bot,
    title: 'O Dr. Kamaia, conselheiro de IA',
    body:
      'Vigia a carteira, sinaliza o que exige atenção e responde a perguntas sobre a legislação angolana com citação ao artigo. Dá sentido a um contrato herdado e assiste na redacção. Apoia a decisão — nunca substitui o aconselhamento jurídico, e cada sugestão fica sujeita a confirmação.',
  },
  {
    icon: Library,
    title: 'Biblioteca viva',
    body:
      'Modelos por tipo de contrato e cláusulas reutilizáveis, com referência ao artigo legal aplicável. Cada cláusula que entra num contrato fica ligada à sua origem — o acervo da organização cresce com a prática real, sem esforço adicional.',
  },
  {
    icon: FileText,
    title: 'Versões com prova de integridade',
    body:
      'Histórico imutável, do primeiro rascunho à versão final assinada, com selo temporal e impressão digital por versão. A versão canónica é sempre identificável — nunca se assina a versão errada.',
  },
  {
    icon: Network,
    title: 'Negociação rastreada',
    body:
      'Pontos em aberto com criticidade, a posição da sua organização e a da contraparte, e o acordo final — ligados às versões que os introduziram e resolveram. Substitui o e-mail com alterações registadas pela memória dispersa.',
  },
  {
    icon: CalendarClock,
    title: 'Alertas que não falham',
    body:
      'Renovação a 90, 30 e 7 dias, janela de denúncia a fechar, Imposto de Selo por liquidar, pagamento devido. Por e-mail, notificação e dentro do sistema — para que nenhuma data-chave passe despercebida.',
  },
  {
    icon: Inbox,
    title: 'Entidades e KYC',
    body:
      'Cada parte de cada contrato é uma entidade — pessoa singular ou colectiva — com NIF, sector de actividade e documentação anexável. Registada uma vez, reutilizada em todos os contratos onde aparece.',
  },
  {
    icon: Banknote,
    title: 'Multi-moeda',
    body:
      'Kwanza, dólar, euro e outras moedas relevantes. Os valores são guardados com precisão de centavo, sem erros de vírgula flutuante, e convertidos para análise quando necessário.',
  },
  {
    icon: Building2,
    title: 'Estrutura para grupos e escritórios',
    body:
      'Uma organização pode separar departamentos ou unidades; um escritório que gere a carteira de vários clientes mantém cada um isolado — pesquisa, dados e auditoria — sob um único acesso. Uma capacidade disponível, não o foco do produto.',
  },
  {
    icon: Lock,
    title: 'Segurança e auditoria',
    body:
      'Isolamento por organização em todas as camadas, registo de auditoria imutável em cada escrita, selo temporal nas versões assinadas, e cifra em repouso e em trânsito. Em conformidade com a Lei de Protecção de Dados.',
  },
]

export default function FuncionalidadesPage() {
  return (
    <>
      <Nav />
      <main className="bg-white">
        <section className="px-6 pt-32 pb-12 text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Funcionalidades
            </p>
            <h1 className="mt-3 font-sans text-[clamp(36px,5vw,64px)] font-medium leading-[1.1] text-neutral-900">
              Da solicitação ao arquivo.
            </h1>
            <p className="mx-auto mt-5 max-w-[680px] text-[15px] leading-relaxed text-neutral-600">
              Um sistema, pensado em conjunto desde o primeiro dia — não um
              conjunto de módulos montados à pressa. Cada capacidade existe ao
              serviço da gestão do ciclo de vida.
            </p>
          </Reveal>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-px bg-neutral-100 md:grid-cols-2 lg:grid-cols-3">
            {CAPACIDADES.map((c) => (
              <Reveal key={c.title}>
                <article className="h-full bg-white p-7">
                  <c.icon className="h-6 w-6 text-neutral-600" aria-hidden="true" />
                  <h3 className="mt-4 font-sans text-xl font-medium text-neutral-900">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
                    {c.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="px-6 py-24 text-center border-t border-neutral-200">
          <Reveal>
            <h2 className="font-sans text-[clamp(28px,3.6vw,40px)] font-medium leading-[1.15] text-neutral-900">
              Falta alguma coisa?
            </h2>
            <p className="mx-auto mt-5 max-w-[580px] text-[15px] leading-relaxed text-neutral-600">
              O produto está em fase inicial e o percurso é desenhado a partir
              de conversas com quem o vai usar. Diga-nos o que a sua organização
              precisa.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/contacto"
                className="inline-flex items-center rounded-md bg-neutral-900 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Falar com a equipa
              </Link>
              <Link
                href={appUrl('/register', 'funcs_cta')}
                className="inline-flex items-center rounded-md border border-neutral-300 bg-neutral-50 px-6 py-3.5 text-sm font-medium text-neutral-900 backdrop-blur-sm transition-colors hover:bg-neutral-100"
              >
                Criar conta
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  )
}
