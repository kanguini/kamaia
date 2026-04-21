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
        <Positioning />
        <Pillars />
        <Features />
        <SocialProof />
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
          Plataforma estratégica de prática jurídica · Early access
        </span>

        {/* Title — Playfair Display */}
        <h1 className="mt-7 mx-auto max-w-[960px] font-playfair text-[clamp(40px,5.4vw,76px)] font-medium leading-[1.06] tracking-[-0.01em] text-white">
          Uma nova forma de ver
          <br />
          <em className="not-italic" style={{ color: '#9cb6ff' }}>
            a prática jurídica.
          </em>
        </h1>

        {/* Description */}
        <p className="mt-6 max-w-[640px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-white/72">
          Kamaia é uma abordagem multidisciplinar à gestão jurídica — que
          transforma o jurista não apenas num agente do direito, mas num
          baluarte da estratégia. Agilidade, celeridade e inteligência nas
          decisões, suportadas por metodologias ágeis e assistência IA.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={appUrl('/register', 'hero_cta')}
            className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
          >
            Aceder ao early access
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Agendar demonstração
          </Link>
        </div>

        {/* Micro-copy */}
        <p className="mt-5 text-[11px] tracking-wide text-white/38">
          Concebido em Angola · Para advogados, escritórios e gabinetes jurídicos
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

// ─── Positioning statement ───────────────────────────────────
function Positioning() {
  return (
    <section className="border-t border-white/5 bg-black py-24 lg:py-32 text-white">
      <div className="shell">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Posicionamento
          </span>
          <h2 className="mt-4 max-w-4xl font-playfair text-[clamp(26px,3.2vw,42px)] font-medium leading-[1.2] tracking-[-0.015em] text-white/92">
            &ldquo;O Kamaia é uma nova forma de ver a prática jurídica. Uma
            abordagem multidisciplinar, que faz do jurista não apenas um agente
            do direito,{' '}
            <em className="not-italic" style={{ color: '#9cb6ff' }}>
              mas um baluarte da estratégia
            </em>
            .&rdquo;
          </h2>
          <p className="mt-8 max-w-2xl text-white/60 leading-relaxed">
            A plataforma eleva a gestão jurídica ao plano estratégico:
            integra tecnologia, metodologias ágeis de gestão de projectos e
            inteligência artificial para gerar resultados mensuráveis — e
            devolver ao jurista o tempo que hoje perde em tarefas operacionais.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Strategic pillars ───────────────────────────────────────
function Pillars() {
  const items = [
    {
      kicker: 'Pilar I',
      title: 'Agilidade e celeridade',
      body: 'Fluxos de trabalho desenhados sobre metodologias ágeis aplicadas ao sector jurídico. Reduz ciclos operacionais e acelera o tempo de resposta ao cliente.',
    },
    {
      kicker: 'Pilar II',
      title: 'Inteligência nas decisões',
      body: 'Dados consolidados, análise em tempo real e um assistente IA que conhece o contexto do gabinete — para que cada decisão seja informada, não intuitiva.',
    },
    {
      kicker: 'Pilar III',
      title: 'Gestão de tempo optimizada',
      body: 'Timesheets, capacidade da equipa e rentabilidade por processo numa única vista. Eleva a produtividade sem sacrificar o rigor técnico.',
    },
    {
      kicker: 'Pilar IV',
      title: 'Tecnologia integrada',
      body: 'Processos, prazos, clientes, facturação e documentação numa só plataforma — eliminando silos e devolvendo coerência à operação jurídica.',
    },
  ]

  return (
    <section className="border-t border-white/5 bg-black py-24 lg:py-32 text-white">
      <div className="shell">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Pilares estratégicos
          </span>
          <h2 className="mt-3 max-w-3xl text-[clamp(28px,3.5vw,44px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Quatro eixos que elevam
            <br />
            <span className="text-white/60">a prática jurídica ao nível estratégico.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.08}>
              <article className="group h-full rounded-xl border border-white/10 bg-white/[0.02] p-7 transition-colors hover:border-white/20">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                  {it.kicker}
                </p>
                <h3 className="mt-3 font-playfair text-2xl font-medium tracking-[-0.01em]">
                  {it.title}
                </h3>
                <div className="my-5 h-px bg-white/5" />
                <p className="text-sm leading-relaxed text-white/72">
                  {it.body}
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
      title: 'Gestão de processos',
      body: 'Workflows adaptáveis por matéria — civil, penal, laboral, M&A, compliance. Visão integrada da timeline, partes envolvidas e documentação.',
    },
    {
      title: 'Prazos e compliance',
      body: 'Cálculo automático de dias úteis e feriados. Alertas multi-canal antes das datas críticas — impossível perder uma etapa relevante.',
    },
    {
      title: 'Gestão de relação com o cliente',
      body: 'CRM jurídico com portal dedicado. O cliente acede ao ponto de situação dos seus processos, reduzindo ruído e aumentando confiança.',
    },
    {
      title: 'Facturação e rentabilidade',
      body: 'Agregação automática de timesheets e despesas. Margem por processo e por cliente — instrumentos para decidir onde investir esforço.',
    },
    {
      title: 'Timesheets e capacidade',
      body: 'Timer integrado ao processo, aprovação estruturada e relatórios de utilização. Transparência sobre onde a equipa gera valor.',
    },
    {
      title: 'Assistente IA contextual',
      body: 'Redacção de peças, síntese de processos e pesquisa jurisprudencial — sempre alinhados com o contexto e histórico do gabinete.',
    },
  ]

  return (
    <section className="border-t border-white/5 bg-black py-24 lg:py-32 text-white">
      <div className="shell">
        <Reveal>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Capacidades
          </span>
          <h2 className="mt-3 max-w-3xl text-[clamp(28px,3.5vw,44px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Um fluxo coerente.
            <br />
            <span className="text-white/60">
              Do primeiro contacto à decisão estratégica.
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
            Explorar capacidades em detalhe
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
            Programa de early adopters
          </span>
          <h2 className="mt-3 max-w-2xl text-[clamp(24px,3vw,36px)] font-medium leading-[1.15] tracking-[-0.02em]">
            Construído em diálogo com gabinetes jurídicos em Angola.
          </h2>
          <p className="mt-6 max-w-2xl text-white/60 leading-relaxed">
            O Kamaia evolui em colaboração próxima com advogados solo,
            escritórios e departamentos jurídicos que definem as prioridades
            da plataforma. Cada iteração nasce de casos reais da prática.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Advogados solo',
              body: 'Ganham estrutura operacional de gabinete sem aumentar custos administrativos — foco integral no trabalho substantivo.',
            },
            {
              title: 'Pequenos gabinetes',
              body: 'Integram processos, clientes e facturação numa só plataforma — reduzindo fricção e aumentando a rentabilidade.',
            },
            {
              title: 'Departamentos jurídicos',
              body: 'Adoptam metodologias ágeis de projecto aplicadas ao direito — com governo, auditoria e isolamento por unidade.',
            },
          ].map((t, i) => (
            <Reveal key={t.title} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                  Segmento
                </div>
                <div className="mt-2 text-base font-medium text-white">
                  {t.title}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  {t.body}
                </p>
              </figure>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-xs uppercase tracking-[0.14em] text-white/35">
          Candidaturas ao early access abertas — fale connosco
        </p>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────
function Faq() {
  const items = [
    {
      q: 'Como é garantida a segurança e confidencialidade dos dados?',
      a: 'Isolamento multi-tenant com RLS no PostgreSQL — nenhum gabinete acede a dados de outro. Todas as escritas geram audit log append-only. Backups diários encriptados e infra-estrutura com cifra em trânsito e em repouso. Os detalhes técnicos estão disponíveis na política de privacidade.',
    },
    {
      q: 'Qual é o tempo típico de adopção?',
      a: 'Um advogado solo configura e regista o primeiro processo em 15 minutos. Escritórios maiores costumam estar em operação em 2 a 3 dias. O onboarding é acompanhado pela equipa em qualquer um dos segmentos.',
    },
    {
      q: 'É possível importar dados existentes?',
      a: 'Sim. Clientes, processos e prazos suportam importação CSV. Gabinetes com histórico noutros sistemas beneficiam de migração assistida pela equipa durante o onboarding.',
    },
    {
      q: 'A plataforma funciona em mobilidade?',
      a: 'A aplicação web é responsiva e usa-se confortavelmente em tablet. A aplicação móvel nativa está planeada para Q3 de 2026 — por agora recomendamos consulta em mobilidade e edição em desktop.',
    },
    {
      q: 'Como se integra a componente de IA?',
      a: 'O assistente IA opera sobre o contexto do próprio gabinete — processos, documentos e histórico —, com governo de acesso e rastreabilidade. Nunca envia dados sensíveis para indexação pública.',
    },
  ]

  return (
    <section className="border-t border-white/5 bg-black py-24 text-white">
      <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Perguntas frequentes
          </span>
          <h2 className="mt-3 text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] tracking-[-0.02em]">
            Respostas diretas
            <br />
            para decisões informadas.
          </h2>
          <p className="mt-6 text-white/60">
            Não encontra a resposta que procura?{' '}
            <Link
              href="/contacto"
              className="text-white underline underline-offset-4"
            >
              Fale connosco
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
          <h2 className="mx-auto max-w-3xl font-playfair text-[clamp(32px,4.5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
            Do operacional
            <br />
            <span style={{ color: '#9cb6ff' }}>ao estratégico.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-white/80">
            Junte-se ao programa de early access e ajude a definir o futuro
            da gestão jurídica em Angola e nos PALOP.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={appUrl('/register', 'cta_final')}
              className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Pedir acesso
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Agendar demonstração
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
