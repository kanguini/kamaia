import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  Scale,
  Users,
  Receipt,
  Timer,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { AnimatedGradient } from '@/components/AnimatedGradient'
import { DashboardMockup } from '@/components/DashboardMockup'
import { Reveal } from '@/components/Reveal'
import { appUrl } from '@/lib/utm'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProblemSolution />
        <Features />
        <FeitoParaAngola />
        <SocialProof />
        <PricingTeaser />
        <Faq />
        <CTAFinal />
      </main>
      <Footer />
    </>
  )
}

// ─── Hero ───────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <AnimatedGradient />
      <div className="relative z-10 shell py-20 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/70 backdrop-blur-sm">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: '#6be49a' }}
              />
              Em produção · Early access aberto
            </span>

            <h1 className="mt-6 text-[clamp(36px,5.2vw,64px)] font-medium leading-[1.04] tracking-[-0.025em]">
              Gestão jurídica inteligente,
              <br />
              <span style={{ color: '#9cb6ff' }}>
                Pessoas, Processos e Tecnologia
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[clamp(15px,1.5vw,18px)] leading-relaxed text-white/80">
              A plataforma feita para advogados angolanos. Processos, prazos,
              timesheets e facturação num só lugar. Com assistente IA que
              redige peças.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href={appUrl('/register', 'hero_cta')}
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
              >
                Começar grátis
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Agendar demo
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.1em] text-white/55">
              <li>14 dias grátis</li>
              <li>Sem cartão de crédito</li>
              <li>Dados em Angola</li>
            </ul>
          </div>

          <div
            className="relative"
            style={{
              transform: 'perspective(1400px) rotateY(-6deg) rotateX(2deg)',
            }}
          >
            <Reveal>
              <DashboardMockup />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Problem → Solution ────────────────────────────────────
function ProblemSolution() {
  const items = [
    {
      icon: AlertTriangle,
      problem: 'Perco prazos processuais',
      solution:
        'Alertas automáticos 7d, 3d e 1d antes. Email + SMS + push — impossível esquecer.',
    },
    {
      icon: Clock,
      problem: 'Não facturo todas as horas',
      solution:
        'Timer integrado no processo. Aprova timesheets e agrega numa factura com um clique.',
    },
    {
      icon: MessageSquare,
      problem: 'Cliente liga a pedir updates',
      solution:
        'Portal do cliente com acesso 24/7 aos seus processos, documentos e facturas.',
    },
  ]

  return (
    <section className="border-t border-white/5 bg-black py-24 lg:py-32 text-white">
      <div className="shell">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Porque Kamaia
          </span>
          <h2 className="mt-3 max-w-3xl text-[clamp(28px,3.5vw,44px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Três problemas recorrentes.
            <br />
            <span className="text-white/60">Uma resposta simples.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.problem} delay={i * 0.08}>
              <article className="group h-full rounded-xl border border-white/10 bg-white/[0.02] p-7 transition-colors hover:border-white/20">
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <it.icon size={18} className="text-white/80" />
                </div>
                <p className="text-sm uppercase tracking-[0.1em] text-white/45">
                  Dor
                </p>
                <p className="mt-2 text-xl font-medium">{it.problem}</p>
                <div className="my-5 h-px bg-white/5" />
                <p className="text-sm uppercase tracking-[0.1em] text-white/45">
                  Kamaia
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  {it.solution}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ──────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: Scale,
      title: 'Processos',
      body: 'Workflows adaptáveis por tipo — civil, penal, laboral, M&A, compliance. Timeline, anexos e partes.',
    },
    {
      icon: Clock,
      title: 'Prazos',
      body: 'Dias úteis angolanos e feriados públicos. Alertas multi-canal antes das datas críticas.',
    },
    {
      icon: Users,
      title: 'Clientes + Portal',
      body: 'CRM leve. Cliente vê os seus processos, documentos e facturas sem tocar no telefone.',
    },
    {
      icon: Receipt,
      title: 'Facturação AKZ',
      body: 'Agrega timesheets facturáveis + despesas. PDF profissional em poucos segundos.',
    },
    {
      icon: Timer,
      title: 'Timesheets + Despesas',
      body: 'Timer no processo. Aprovação. Relatórios de utilização e margem por processo.',
    },
    {
      icon: Sparkles,
      title: 'IA Assistente',
      body: 'Redacção de peças, resumos de processos, pesquisa jurisprudencial. Com o teu contexto.',
    },
  ]

  return (
    <section className="border-t border-white/5 bg-black py-24 lg:py-32 text-white">
      <div className="shell">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Funcionalidades
          </span>
          <h2 className="mt-3 max-w-3xl text-[clamp(28px,3.5vw,44px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Tudo num só fluxo.
            <br />
            <span className="text-white/60">
              Do primeiro contacto ao recibo final.
            </span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <article className="h-full rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-[#4a7dff]/20 to-[#4a7dff]/5 border border-[#4a7dff]/20">
                  <f.icon size={18} style={{ color: '#9cb6ff' }} />
                </div>
                <h3 className="text-lg font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {f.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/funcionalidades"
            className="inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
          >
            Ver todas as funcionalidades
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Feito para Angola ─────────────────────────────────────
function FeitoParaAngola() {
  const bullets = [
    'Moeda AKZ · separador decimal angolano',
    'Feriados públicos angolanos incluídos',
    'Dias úteis automáticos para cálculo de prazos',
    'Horário de Luanda (WAT, UTC+1) em todos os eventos',
    'Campo OAA por advogado',
    'Multi-tenant com RLS — gabinetes isolados',
    'Audit log append-only · rastreabilidade total',
    'Dados e backups em infraestrutura compatível',
  ]

  return (
    <section className="border-t border-white/5 py-24 lg:py-32 text-white relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          background:
            'radial-gradient(600px 400px at 80% 20%, #cc0000, transparent 60%), radial-gradient(400px 300px at 20% 80%, #ffcc00, transparent 60%)',
        }} />
      <div className="shell grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Feito para Angola
          </span>
          <h2 className="mt-3 text-[clamp(28px,3.5vw,44px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Um produto local,
            <br />
            <span className="text-white/60">não uma tradução.</span>
          </h2>
          <p className="mt-6 max-w-md text-white/70 leading-relaxed">
            Os SaaS internacionais assumem EUR, feriados europeus e fuso GMT.
            Nós partimos do contexto jurídico angolano e construímos a partir
            daí.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="grid gap-3 md:grid-cols-2">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/80"
              >
                <CheckCircle2
                  size={16}
                  className="mt-0.5 flex-shrink-0 text-[#6be49a]"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Social proof placeholder ──────────────────────────────
function SocialProof() {
  return (
    <section className="border-t border-white/5 bg-black py-24 text-white">
      <div className="shell">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Em uso em gabinetes reais
          </span>
          <h2 className="mt-3 max-w-2xl text-[clamp(24px,3vw,36px)] font-medium leading-[1.15] tracking-[-0.02em]">
            Advogados que já adoptaram o Kamaia.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              name: 'GMS Advogados',
              role: 'Gabinete de 4 advogados · Luanda',
              quote:
                'Antes perdíamos 15–20% das horas facturáveis por falta de registo. Agora cobramos tudo.',
            },
            {
              name: 'Early adopter',
              role: 'Advogado solo · Benguela',
              quote:
                'Os alertas de prazo foram o ponto de entrada. O resto aprendi em 2 dias.',
            },
            {
              name: 'Early adopter',
              role: 'Gabinete M&A · Luanda',
              quote:
                'Os workflows por tipo de processo fazem toda a diferença. Não se perde etapa.',
            },
          ].map((t, i) => (
            <Reveal key={t.name + i} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <blockquote className="text-sm leading-relaxed text-white/85">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-auto pt-6">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-white/50">{t.role}</div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-xs uppercase tracking-[0.14em] text-white/35">
          Programa de early adopters — contacta-nos para fazer parte
        </p>
      </div>
    </section>
  )
}

// ─── Pricing teaser ────────────────────────────────────────
function PricingTeaser() {
  return (
    <section className="border-t border-white/5 bg-black py-24 text-white">
      <div className="shell text-center">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Preços
          </span>
          <h2 className="mt-3 mx-auto max-w-2xl text-[clamp(28px,3.5vw,44px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Simples. Por utilizador.
            <br />
            <span className="text-white/60">Sem surpresas.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-white/70 leading-relaxed">
            Planos desde advogado solo até gabinetes com mais de 10 advogados.
            14 dias grátis para qualquer plano.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/precos"
              className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Ver planos e preços
              <ArrowRight size={14} />
            </Link>
            <Link
              href={appUrl('/register', 'pricing')}
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Começar grátis
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────
function Faq() {
  const items = [
    {
      q: 'Os meus dados estão seguros?',
      a: 'Sim. Usamos isolamento multi-tenant com RLS no PostgreSQL: nenhum gabinete vê dados de outro. Todas as escritas geram audit log append-only. Backups diários encriptados. Os detalhes técnicos estão na nossa política de privacidade.',
    },
    {
      q: 'Quanto tempo demora a aprender?',
      a: 'Um advogado solo configura e regista o primeiro processo em 15 minutos. Gabinetes maiores costumam estar produtivos em 2–3 dias. Fazemos onboarding dedicado nos planos Gabinete e Pro Business.',
    },
    {
      q: 'Posso importar dados do Excel?',
      a: 'Sim. Clientes, processos e prazos têm importação CSV. Para gabinetes com histórico em outros softwares, fazemos a migração sem custo no onboarding.',
    },
    {
      q: 'Funciona em telemóvel?',
      a: 'A aplicação é responsiva e usa-se confortavelmente em tablet. App móvel nativa vem no Q3 2026 — por agora recomendamos consulta em mobile e escrita em desktop.',
    },
    {
      q: 'O que acontece no fim do trial?',
      a: 'Avisamos 3 dias antes. Se não escolheres um plano, a conta entra em modo só-leitura: continuas a ver os dados mas não podes editar. Nunca apagamos nada sem confirmação.',
    },
  ]
  return (
    <section className="border-t border-white/5 bg-black py-24 text-white">
      <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            FAQ
          </span>
          <h2 className="mt-3 text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Perguntas
            <br />
            mais frequentes.
          </h2>
          <p className="mt-6 text-white/60">
            Não encontras resposta?{' '}
            <Link href="/contacto" className="text-white underline underline-offset-4">
              Fala connosco
            </Link>
            .
          </p>
        </div>

        <ul className="divide-y divide-white/10 border-y border-white/10">
          {items.map((it, i) => (
            <li key={i} className="py-5">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                  <span className="text-[15px] font-medium">{it.q}</span>
                  <span
                    className="text-white/40 transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  {it.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── CTA Final ────────────────────────────────────────────
function CTAFinal() {
  return (
    <section className="relative overflow-hidden border-t border-white/5 py-28">
      <AnimatedGradient />
      <div className="relative z-10 shell text-center text-white">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-[clamp(32px,4.5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
            Menos horas a administrar.
            <br />
            <span style={{ color: '#9cb6ff' }}>Mais horas a advogar.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-white/80">
            14 dias grátis. Sem cartão de crédito. Suporte directo do fundador.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={appUrl('/register', 'cta_final')}
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Começar agora
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Agendar demo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
