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
    'Ciclo de vida completo do contrato — drafting, negociação, assinatura, vida activa, terminação — com compliance angolano embebido e IA sobre legislação local.',
  alternates: { canonical: '/funcionalidades' },
  openGraph: {
    title: 'Funcionalidades · Kamaia CLM',
    description:
      'Tudo o que precisas para gerir contratos em Angola: ciclo de vida, compliance, biblioteca, IA, importação em massa.',
  },
}

const CAPACIDADES = [
  {
    icon: Workflow,
    title: 'Ciclo de vida completo',
    body:
      'Solicitação → Drafting → Revisão interna → Revisão pelo cliente → Negociação → Aprovação → Pronto para assinatura → Assinado → Pós-assinatura → Activo → Adendas → Terminação → Arquivo. 17 estados, transições validadas, timeline imutável por contrato.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance angolano embebido',
    body:
      'Motor declarativo de regras versionadas. Imposto de Selo (11 verbas TGIS seed), Registos (Predial, Comercial, Automóvel, IAPI), BNA/Lei Cambial/RJOC, retenção AGT IRT sobre não-residentes, reconhecimento notarial obrigatório. A regra vigente à data do facto tributário é a aplicável — não a data presente.',
  },
  {
    icon: Bot,
    title: 'IA sobre legislação angolana',
    body:
      'Q&A com citação ao artigo. Catálogo seed cobre Constituição, Códigos Civil/Comercial, Lei das Sociedades Comerciais, Código do Imposto de Selo, Lei Cambial, Lei Geral do Trabalho, Lei do Investimento Privado, Lei 22/11 e Lei 3/14. A IA sugere; o utilizador valida.',
  },
  {
    icon: Boxes,
    title: 'Modo Repositório · Importação em massa',
    body:
      'Carrega PDFs e ZIPs da carteira legada. Pipeline assíncrono de OCR + extracção IA preenche partes, datas-chave e valor. Revisão humana obrigatória antes de publicar como Activo.',
  },
  {
    icon: Library,
    title: 'Biblioteca viva',
    body:
      'Templates por tipo de contrato. Cláusulas reutilizáveis com referência ao artigo legal aplicável. usoCount sobe automaticamente sempre que uma cláusula entra num contrato — a biblioteca do gabinete cresce sozinha com a prática real.',
  },
  {
    icon: FileText,
    title: 'Versões com selo temporal',
    body:
      'Histórico imutável: V0.1 interno → V1.0 enviado à contraparte → V2.3 final assinado. Hash SHA-256 e timestamp por versão. A versão canónica é sempre identificável — nunca mais assinas a versão errada.',
  },
  {
    icon: Network,
    title: 'Negociação rastreada',
    body:
      'Pontos abertos com criticidade (baixa/média/alta/crítica), posição nossa, posição da contraparte e acordo final. Linkados às versões que os introduziram e resolveram. Substitui o caos do email com track-changes.',
  },
  {
    icon: CalendarClock,
    title: 'Alertas multicanal',
    body:
      'Renovação automática em 90/30/7 dias. Janela de denúncia a fechar. IS por liquidar. Pagamento devido. Email + push web + in-app — não vais perder uma data-chave.',
  },
  {
    icon: Building2,
    title: 'Hierarquia multi-tenant',
    body:
      'Plano AGENCY: sociedades de advogados gerem N clientes isolados num só interface. Workspace switcher tipo Linear. Audit cruzado garante defesa legal entre clientes do mesmo gabinete.',
  },
  {
    icon: Inbox,
    title: 'Entidades + KYC',
    body:
      'Cada parte de cada contrato é uma Entidade (pessoa singular ou colectiva) com NIF, sector de actividade, nacionalidade cambial e KYC anexável. Reutilizada em todos os contratos onde aparece.',
  },
  {
    icon: Banknote,
    title: 'Multi-moeda',
    body:
      'AKZ, USD, EUR, BRL, CNY, GBP, ZAR. Valor armazenado em BigInt (centavos) — nunca floats. Taxa de câmbio para análise convertida automaticamente.',
  },
  {
    icon: Lock,
    title: 'Segurança e auditoria',
    body:
      'Isolamento por tenant em todas as camadas. Audit log append-only em todas as escritas. Hash + selo temporal em versões assinadas. Storage R2 / S3 com cifra. Lockout por falhas de login. Conforme Lei 22/11.',
  },
]

export default function FuncionalidadesPage() {
  return (
    <>
      <Nav />
      <main className="bg-black">
        <section className="px-6 pt-32 pb-12 text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Funcionalidades
            </p>
            <h1 className="mt-3 font-playfair text-[clamp(36px,5vw,64px)] font-medium leading-[1.1] text-white">
              Contratos da solicitação ao arquivo.
            </h1>
            <p className="mx-auto mt-5 max-w-[680px] text-[15px] leading-relaxed text-white/65">
              Um sistema, doze capacidades. Pensadas em conjunto desde o dia
              zero — não montadas a partir de módulos desconexos.
            </p>
          </Reveal>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-3">
            {CAPACIDADES.map((c) => (
              <Reveal key={c.title}>
                <article className="h-full bg-black p-7">
                  <c.icon className="h-6 w-6 text-white/70" aria-hidden="true" />
                  <h3 className="mt-4 font-playfair text-xl font-medium text-white">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                    {c.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="px-6 py-24 text-center border-t border-white/10">
          <Reveal>
            <h2 className="font-playfair text-[clamp(28px,3.6vw,40px)] font-medium leading-[1.15] text-white">
              Falta alguma coisa?
            </h2>
            <p className="mx-auto mt-5 max-w-[580px] text-[15px] leading-relaxed text-white/60">
              Estamos em early access. O roadmap inspira-se em conversas com
              quem vai usar o produto.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/contacto"
                className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
              >
                Falar com a equipa
              </Link>
              <Link
                href={appUrl('/register', 'funcs_cta')}
                className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Experimentar
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  )
}
