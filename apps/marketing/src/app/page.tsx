import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { AnimatedGradient } from '@/components/AnimatedGradient'
import { HeroFloatingCards } from '@/components/HeroFloatingCards'
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
        <SocialProof />
        <PricingTeaser />
        <Faq />
        <CTAFinal />
      </main>
      <Footer />
    </>
  )
}

// ─── Hero ────────────────────────────────────────────────────
function Hero() {
  return (
    /*
     * marginTop: -68px pulls the section up behind the sticky nav (68px tall).
     * paddingTop: 68px compensates so content doesn't overlap the nav.
     * overflow-x: clip prevents side-overflow from floating cards without
     * creating a new scroll container (unlike overflow-x: hidden).
     */
    <section
      className="relative flex flex-col"
      style={{
        marginTop: '-68px',
        paddingTop: '68px',
        minHeight: '100svh',
        overflowX: 'clip',
      }}
    >
      <AnimatedGradient />

      {/* Dot-grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage:
            'radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      {/* ── Text block ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 pt-[clamp(80px,12vh,130px)] pb-10">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] text-white/65 backdrop-blur-sm">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: '#6be49a' }}
          />
          Assistente IA integrado · Early access aberto
        </span>

        {/* Title — Playfair Display */}
        <h1 className="mt-7 mx-auto max-w-[900px] font-playfair text-[clamp(40px,5.4vw,76px)] font-medium leading-[1.06] tracking-[-0.01em] text-white">
          Menos administração.
          <br />
          <em className="not-italic" style={{ color: '#9cb6ff' }}>
            Mais advocacia.
          </em>
        </h1>

        {/* Description */}
        <p className="mt-6 max-w-[600px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-white/68">
          Plataforma completa para advogados, escritórios e gabinetes jurídicos.
          Processos, prazos, timesheets e facturação num só lugar —
          com assistente IA que conhece o teu contexto.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={appUrl('/register', 'hero_cta')}
            className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
          >
            Começar grátis
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Ver demonstração
          </Link>
        </div>

        {/* Micro-copy */}
        <p className="mt-5 text-[11px] tracking-wide text-white/38">
          14 dias grátis · Sem cartão de crédito · Cancela quando queres
        </p>
      </div>

      {/* ── Floating cards + mockup (client component — mouse parallax) ── */}
      <HeroFloatingCards />

      {/* Subtle fade into the next section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-20"
        style={{ background: 'linear-gradient(to bottom, transparent, #000 95%)' }}
      />
    </section>
  )
}

// ─── Problem → Solution ──────────────────────────────────────
function ProblemSolution() {
  const items = [
    {
      problem: 'Perco prazos processuais',
      solution:
        'Alertas automáticos 7d, 3d e 1d antes. Email + SMS + push — impossível esquecer.',
    },
    {
      problem: 'Não facturo todas as horas',
      solution:
        'Timer integrado no processo. Aprova timesheets e agrega numa factura com um clique.',
    },
    {
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

// ─── Features ────────────────────────────────────────────────
function Features() {
  const features = [
    {
      title: 'Processos',
      body: 'Workflows adaptáveis por tipo — civil, penal, laboral, M&A, compliance. Timeline, anexos e partes.',
    },
    {
      title: 'Prazos',
      body: 'Cálculo automático de dias úteis e feriados. Alertas multi-canal antes das datas críticas.',
    },
    {
      title: 'Clientes + Portal',
      body: 'CRM leve. O cliente vê os seus processos, documentos e facturas sem precisar de ligar.',
    },
    {
      title: 'Facturação',
      body: 'Agrega timesheets facturáveis e despesas. PDF profissional gerado em poucos segundos.',
    },
    {
      title: 'Timesheets + Despesas',
      body: 'Timer integrado no processo. Aprovação, relatórios de utilização e margem por processo.',
    },
    {
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
                <p className="mb-4 text-[11px] font-medium tabular-nums text-white/30 tracking-widest">
                  {String(i + 1).padStart(2, '0')}
                </p>
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
            className="text-sm text-white/75 transition-colors hover:text-white underline underline-offset-4 decoration-white/20"
          >
            Ver todas as funcionalidades
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Social proof ─────────────────────────────────────────────
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
              role: 'Gabinete de 4 advogados',
              quote:
                'Antes perdíamos 15–20% das horas facturáveis por falta de registo. Agora cobramos tudo.',
            },
            {
              name: 'Early adopter',
              role: 'Advogado solo',
              quote:
                'Os alertas de prazo foram o ponto de entrada. O resto aprendi em 2 dias.',
            },
            {
              name: 'Early adopter',
              role: 'Gabinete M&A',
              quote:
                'Os workflows por tipo de processo fazem toda a diferença. Não se perde uma etapa.',
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

// ─── Pricing teaser ───────────────────────────────────────────
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
            Planos para advogado solo, pequenos gabinetes e grandes escritórios.
            14 dias grátis para qualquer plano.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/precos"
              className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Ver planos e preços
            </Link>
            <Link
              href={appUrl('/register', 'pricing')}
              className="inline-flex items-center rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Começar grátis
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────
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
      a: 'Sim. Clientes, processos e prazos têm importação CSV. Para gabinetes com histórico noutros softwares, fazemos a migração sem custo durante o onboarding.',
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
            <Link
              href="/contacto"
              className="text-white underline underline-offset-4"
            >
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
                    className="flex-shrink-0 text-white/40 transition-transform group-open:rotate-45"
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

// ─── CTA Final ────────────────────────────────────────────────
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
            14 dias grátis. Sem cartão de crédito. Suporte directo da equipa.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={appUrl('/register', 'cta_final')}
              className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Começar agora
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Agendar demo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
