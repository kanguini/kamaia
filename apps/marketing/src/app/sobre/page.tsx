import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Server, FileLock, Globe2 } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'

export const metadata: Metadata = {
  title: 'Sobre',
  description:
    'Kamaia nasce em Angola para elevar a prática jurídica ao nível estratégico. Conheça a missão, a abordagem multidisciplinar e as decisões técnicas que diferenciam a plataforma.',
  alternates: { canonical: '/sobre' },
  openGraph: {
    title: 'Sobre · Kamaia',
    description:
      'Do jurista-agente ao jurista-estratega. A visão, a equipa e a arquitectura por detrás do Kamaia.',
    url: '/sobre',
    type: 'website',
  },
}

export default function SobrePage() {
  return (
    <>
      <Nav />
      <main className="bg-black text-white">
        <section className="border-b border-white/5 py-24">
          <div className="shell">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Sobre
              </span>
              <h1 className="mt-3 max-w-3xl text-[clamp(36px,5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
                Tecnologia jurídica
                <br />
                <span style={{ color: '#9cb6ff' }}>
                  feita por e para advogados.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/75">
                Kamaia nasce de uma dor real: gerir um gabinete com ferramentas
                improvisadas. Excel, emails, WhatsApps e papel não chegam para
                uma prática moderna.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Missão */}
        <section className="border-b border-white/5 py-20">
          <div className="shell grid gap-12 md:grid-cols-[1fr_1.3fr] md:items-start">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Missão
              </span>
              <h2 className="mt-3 text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] tracking-[-0.02em]">
                Menos horas a administrar.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="space-y-5 text-[15px] leading-relaxed text-white/75">
                <p>
                  A profissão jurídica passa por uma transformação. Mais
                  clientes, mais tipos de processos, mais exigências de
                  compliance. Menos tempo para os casos em si.
                </p>
                <p>
                  Kamaia existe para devolver esse tempo. Automatizamos o
                  trabalho repetitivo — prazos, timesheets, facturação — para
                  que os advogados se possam concentrar no que só eles podem
                  fazer: pensar, negociar, argumentar.
                </p>
                <p>
                  Somos ambiciosos mas específicos: não queremos ser o próximo
                  SaaS genérico com má tradução. Queremos ser o produto certo
                  para quem exerce advocacia — com os detalhes no sítio certo.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Fundador */}
        <section className="border-b border-white/5 py-20">
          <div className="shell grid gap-12 md:grid-cols-[1fr_1.3fr]">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Fundador
              </span>
              <h2 className="mt-3 text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] tracking-[-0.02em]">
                Helder Maiato
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Sócio-gestor GMS Advogados · fundador Kamaia
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="space-y-5 text-[15px] leading-relaxed text-white/75">
                <p>
                  Depois de anos a construir um gabinete com ferramentas
                  improvisadas, percebi que a solução não existia. Construi uma
                  para uso interno — e os outros advogados que experimentaram
                  pediram acesso.
                </p>
                <p>
                  Kamaia é o resultado: software construído por quem o usa
                  todos os dias. Cada decisão — dos workflows às cores dos
                  sinalizadores de estado — nasceu de um problema que vivi.
                </p>
                <p>
                  A equipa está a crescer. Se és advogado, developer ou
                  designer e queres trabalhar num produto que muda a forma como
                  os gabinetes operam,{' '}
                  <Link
                    href="/contacto"
                    className="text-white underline underline-offset-4"
                  >
                    fala connosco
                  </Link>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Valores / tech */}
        <section className="border-b border-white/5 py-20">
          <div className="shell">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Como trabalhamos
              </span>
              <h2 className="mt-3 max-w-2xl text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] tracking-[-0.02em]">
                Privacidade, conformidade e rigor.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Shield,
                  title: 'Isolamento multi-tenant',
                  body:
                    'Row-Level Security no PostgreSQL: nenhum gabinete vê dados de outro. Dupla camada em app + BD.',
                },
                {
                  icon: FileLock,
                  title: 'Audit log append-only',
                  body:
                    'Todas as escritas geram registo imutável. Rastreabilidade total para auditorias e disputas.',
                },
                {
                  icon: Server,
                  title: 'Infraestrutura segura',
                  body:
                    'Dados e backups encriptados em repouso (AES-256) e em trânsito (TLS 1.3). Conformidade com as exigências legais aplicáveis.',
                },
                {
                  icon: Globe2,
                  title: 'Português jurídico, primeiro',
                  body:
                    'Interface, emails e templates em português jurídico. Workflows, prazos e formatos calibrados para a prática real.',
                },
              ].map((v, i) => (
                <Reveal key={v.title} delay={i * 0.05}>
                  <article className="h-full rounded-xl border border-white/10 bg-white/[0.02] p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5">
                      <v.icon size={16} className="text-white/80" />
                    </div>
                    <h3 className="text-base font-medium">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      {v.body}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24">
          <div className="shell text-center">
            <Reveal>
              <h2 className="mx-auto max-w-2xl text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.15] tracking-[-0.02em]">
                Queres fazer parte?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-white/70">
                Programa de early adopters aberto. 6 meses de Plano Gabinete
                gratuito para os primeiros 20 gabinetes que aderirem.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/contacto?plan=EARLY_ADOPTER"
                  className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
                >
                  Candidatar-me
                </Link>
                <Link
                  href="/funcionalidades"
                  className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                >
                  Ver funcionalidades
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
