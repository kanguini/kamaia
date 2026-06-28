import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { appUrl } from '@/lib/utm'

export const metadata: Metadata = {
  title: 'Preços · Kamaia CLM',
  description:
    'Quatro planos por escala da carteira de contratos: Starter, Growth, Scale e Enterprise. Disponível também para escritórios que gerem a carteira de vários clientes.',
}

const PLANS = [
  {
    name: 'Starter',
    tag: 'Para começar',
    headline: 'Para empresas e equipas pequenas que querem pôr a carteira em ordem.',
    price: 'Sob consulta',
    features: [
      'Até 200 contratos',
      '3 utilizadores',
      '5 GB de armazenamento',
      '100 mensagens de IA / mês',
      'Compliance angolano completo',
      'Importação da carteira existente',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Growth',
    tag: 'Mais escolhido',
    headline: 'Para empresas com carteira média e equipa jurídica interna.',
    price: 'Sob consulta',
    highlight: true,
    features: [
      'Até 2.000 contratos',
      '10 utilizadores',
      '50 GB de armazenamento',
      '1.000 mensagens de IA / mês',
      'Webhooks',
      'Biblioteca de cláusulas e modelos',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Scale',
    tag: 'Para grandes carteiras',
    headline: 'Para organizações com dezenas de milhares de contratos e vários departamentos.',
    price: 'Sob consulta',
    features: [
      'Até 20.000 contratos',
      '30 utilizadores',
      '500 GB de armazenamento',
      '10.000 mensagens de IA / mês',
      'API pública e webhooks',
      'Autenticação única (SSO)',
      'Tempo de resposta garantido',
    ],
  },
  {
    name: 'Enterprise',
    tag: 'Sob medida',
    headline: 'Carteiras sem limite, instalação dedicada e integrações à medida.',
    price: 'Sob consulta',
    features: [
      'Contratos ilimitados',
      'Utilizadores ilimitados',
      'Armazenamento ilimitado',
      'IA sem limite de plano',
      'Instalação dedicada ou local',
      'Gestor de conta dedicado',
      'Nível de serviço de 99,95%',
    ],
  },
]

const AGENCY = {
  headline: 'Para escritórios que gerem a carteira de vários clientes.',
  features: [
    'Um espaço isolado por cliente — dados, pesquisa e auditoria separados',
    'Alternância entre clientes num único acesso',
    'Registo de auditoria por cliente',
    'API e webhooks',
    'A facturação é feita apenas ao escritório',
  ],
}

export default function PrecosPage() {
  return (
    <>
      <Nav />
      <main className="bg-black">
        <section className="px-6 pt-32 pb-12 text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Preços</p>
            <h1 className="mt-3 font-playfair text-[clamp(36px,5vw,64px)] font-medium leading-[1.1] text-white">
              Um plano à escala da sua carteira.
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[15px] leading-relaxed text-white/65">
              Os valores são indicados sob consulta enquanto o produto está em
              fase inicial. Falamos consigo para definir o plano certo ao volume
              real dos seus contratos.
            </p>
          </Reveal>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <Reveal key={plan.name}>
                <article
                  className={
                    'flex h-full flex-col rounded-2xl border p-7 transition-colors ' +
                    (plan.highlight
                      ? 'border-white/30 bg-white/[0.04]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20')
                  }
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                    {plan.tag}
                  </p>
                  <h2 className="mt-2 font-playfair text-3xl font-medium text-white">
                    {plan.name}
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                    {plan.headline}
                  </p>
                  <p className="mt-5 text-2xl font-medium text-white">
                    {plan.price}
                  </p>
                  <ul className="mt-6 space-y-2 text-[14px] text-white/70">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-white/35">·</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <Link
                      href="/contacto"
                      className={
                        'inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ' +
                        (plan.highlight
                          ? 'bg-white text-black hover:bg-white/90'
                          : 'border border-white/25 bg-white/5 text-white hover:bg-white/10')
                      }
                    >
                      Falar com a equipa
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="px-6 py-24 border-t border-white/10">
          <Reveal>
            <div className="mx-auto max-w-[1080px] rounded-2xl border border-white/10 bg-white/[0.02] p-10 md:p-14">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Para escritórios
              </p>
              <h2 className="mt-3 font-playfair text-[clamp(28px,3.6vw,40px)] font-medium leading-[1.15] text-white">
                {AGENCY.headline}
              </h2>
              <ul className="mt-7 grid grid-cols-1 gap-2 text-[14px] text-white/70 md:grid-cols-2">
                {AGENCY.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-white/35">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/contacto"
                  className="inline-flex items-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
                >
                  Falar com a equipa
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="px-6 py-24 text-center">
          <Reveal>
            <h2 className="font-playfair text-[clamp(28px,3.6vw,40px)] font-medium leading-[1.15] text-white">
              Avaliação de 30 dias em qualquer plano.
            </h2>
            <p className="mx-auto mt-5 max-w-[600px] text-[15px] leading-relaxed text-white/60">
              Importe a carteira que já tem, veja os alertas a funcionar e decida
              com factos.
            </p>
            <div className="mt-8">
              <Link
                href={appUrl('/register', 'precos_cta')}
                className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
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
