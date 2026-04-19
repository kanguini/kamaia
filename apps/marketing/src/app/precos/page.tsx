import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus, ArrowRight } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { appUrl } from '@/lib/utm'

export const metadata: Metadata = {
  title: 'Preços',
  description:
    'Planos Kamaia — Solo, Gabinete e Pro Business. 14 dias grátis em qualquer plano. Preços em AKZ, sem taxas escondidas.',
}

interface Plan {
  id: 'trial' | 'solo' | 'gabinete' | 'pro'
  name: string
  price: string
  unit?: string
  headline: string
  featured?: boolean
  cta: { label: string; href: string }
  includes: string[]
}

// NOTE: valores placeholder — validar com 3 advogados antes do launch
const PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Trial',
    price: 'Grátis',
    headline: '14 dias · sem cartão',
    cta: { label: 'Começar', href: appUrl('/register', 'pricing', 'TRIAL') },
    includes: [
      'Até 3 utilizadores',
      'Processos ilimitados',
      '1 GB de armazenamento',
      '50 queries IA',
      'Suporte por email',
    ],
  },
  {
    id: 'solo',
    name: 'Solo',
    price: '15.000',
    unit: 'AKZ / mês',
    headline: 'Advogado solo',
    cta: { label: 'Escolher Solo', href: appUrl('/register', 'pricing', 'SOLO') },
    includes: [
      '1 utilizador',
      'Até 100 processos activos',
      '5 GB de armazenamento',
      '200 queries IA / mês',
      'Suporte prioritário',
    ],
  },
  {
    id: 'gabinete',
    name: 'Gabinete',
    price: '45.000',
    unit: 'AKZ / mês',
    headline: 'Gabinetes 2–10 advogados',
    featured: true,
    cta: { label: 'Escolher Gabinete', href: appUrl('/register', 'pricing', 'GABINETE') },
    includes: [
      'Até 10 utilizadores',
      'Processos ilimitados',
      '50 GB de armazenamento',
      '1 000 queries IA / mês',
      'Portal do cliente',
      'Onboarding assistido',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Business',
    price: 'Sob consulta',
    headline: 'Gabinetes +10 advogados',
    cta: { label: 'Falar com vendas', href: '/contacto?plan=PRO' },
    includes: [
      'Utilizadores ilimitados',
      'Processos ilimitados',
      '500 GB de armazenamento',
      'Queries IA ilimitadas',
      'SSO e RBAC avançado',
      'SLA + account manager',
    ],
  },
]

// Feature comparison matrix — columns map onto the plans above
const COMPARISON: Array<{ group: string; rows: Array<{ label: string; values: (string | boolean)[] }> }> = [
  {
    group: 'Núcleo',
    rows: [
      { label: 'Processos', values: ['Ilimitados', '100 activos', 'Ilimitados', 'Ilimitados'] },
      { label: 'Clientes', values: ['Ilimitados', 'Ilimitados', 'Ilimitados', 'Ilimitados'] },
      { label: 'Prazos com alertas multi-canal', values: [true, true, true, true] },
      { label: 'Dashboard executivo', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Colaboração',
    rows: [
      { label: 'Utilizadores', values: ['Até 3', '1', 'Até 10', 'Ilimitados'] },
      { label: 'Portal do cliente', values: [false, false, true, true] },
      { label: 'SSO (SAML / Google Workspace)', values: [false, false, false, true] },
      { label: 'RBAC avançado', values: [false, false, true, true] },
    ],
  },
  {
    group: 'IA & automação',
    rows: [
      { label: 'IA Assistente — queries / mês', values: ['50', '200', '1 000', 'Ilimitadas'] },
      { label: 'Workflows customizáveis', values: [false, true, true, true] },
      { label: 'Integrações (Google Calendar, etc)', values: [false, 'básicas', true, true] },
    ],
  },
  {
    group: 'Facturação & reporting',
    rows: [
      { label: 'Facturação AKZ', values: [true, true, true, true] },
      { label: 'Timesheets e despesas', values: [true, true, true, true] },
      { label: 'Relatórios avançados', values: [false, false, true, true] },
      { label: 'Exportação contabilística', values: [false, false, true, true] },
    ],
  },
  {
    group: 'Suporte & conformidade',
    rows: [
      { label: 'Suporte email', values: [true, true, true, true] },
      { label: 'Suporte prioritário', values: [false, true, true, true] },
      { label: 'SLA 99,9%', values: [false, false, false, true] },
      { label: 'Audit log append-only', values: [true, true, true, true] },
      { label: 'Onboarding assistido', values: [false, false, true, true] },
    ],
  },
]

export default function PrecosPage() {
  return (
    <>
      <Nav />
      <main className="bg-black text-white">
        {/* Hero */}
        <section className="border-b border-white/5 py-24">
          <div className="shell text-center">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Preços
              </span>
              <h1 className="mx-auto mt-3 max-w-3xl text-[clamp(36px,5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
                Simples. Por utilizador.
                <br />
                <span style={{ color: '#9cb6ff' }}>Sem surpresas.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-white/75">
                Todos os planos incluem 14 dias grátis, sem cartão de crédito.
                Cancela quando quiseres.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Plans grid */}
        <section className="border-b border-white/5 py-20">
          <div className="shell">
            <div className="grid gap-4 lg:grid-cols-4">
              {PLANS.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 0.05}>
                  <article
                    className={
                      'flex h-full flex-col rounded-xl border p-7 ' +
                      (plan.featured
                        ? 'border-[#4a7dff] bg-gradient-to-b from-[#4a7dff]/10 to-transparent'
                        : 'border-white/10 bg-white/[0.02]')
                    }
                  >
                    {plan.featured && (
                      <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#4a7dff] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                        Recomendado
                      </span>
                    )}
                    <h2 className="text-lg font-medium">{plan.name}</h2>
                    <p className="mt-1 text-xs text-white/55">{plan.headline}</p>

                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-[clamp(28px,3.2vw,38px)] font-medium tracking-[-0.02em]">
                        {plan.price}
                      </span>
                      {plan.unit && (
                        <span className="text-sm text-white/55">{plan.unit}</span>
                      )}
                    </div>

                    <Link
                      href={plan.cta.href}
                      className={
                        'mt-6 inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium transition-all ' +
                        (plan.featured
                          ? 'bg-white text-black hover:scale-[1.02]'
                          : 'border border-white/20 bg-white/5 text-white hover:bg-white/10')
                      }
                    >
                      {plan.cta.label}
                      <ArrowRight size={13} />
                    </Link>

                    <ul className="mt-7 space-y-2.5 text-sm text-white/80">
                      {plan.includes.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <Check
                            size={14}
                            className="mt-0.5 flex-shrink-0 text-[#6be49a]"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              ))}
            </div>

            <p className="mt-8 text-center text-xs text-white/45">
              Preços mensais antes de IVA. Desconto anual: -15% (facturação
              antecipada).
            </p>
          </div>
        </section>

        {/* Comparison */}
        <section className="border-b border-white/5 py-24">
          <div className="shell">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Comparar planos
              </span>
              <h2 className="mt-3 text-[clamp(24px,3vw,36px)] font-medium leading-[1.15] tracking-[-0.02em]">
                Tudo o que está incluído.
              </h2>
            </Reveal>

            <div className="mt-12 overflow-x-auto">
              <table className="w-full min-w-[800px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-black py-4 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
                      Funcionalidade
                    </th>
                    {PLANS.map((p) => (
                      <th
                        key={p.id}
                        className={
                          'py-4 text-left text-[11px] font-medium uppercase tracking-[0.12em] ' +
                          (p.featured ? 'text-[#9cb6ff]' : 'text-white/45')
                        }
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((group) => (
                    <>
                      <tr key={`group-${group.group}`}>
                        <td
                          colSpan={PLANS.length + 1}
                          className="pt-10 pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40"
                        >
                          {group.group}
                        </td>
                      </tr>
                      {group.rows.map((row, ri) => (
                        <tr
                          key={`${group.group}-${ri}`}
                          className="border-t border-white/5"
                        >
                          <td className="sticky left-0 bg-black py-3 text-white/80">
                            {row.label}
                          </td>
                          {row.values.map((v, vi) => (
                            <td
                              key={vi}
                              className={
                                'py-3 text-white/75 ' +
                                (PLANS[vi]?.featured ? 'font-medium text-white' : '')
                              }
                            >
                              {v === true ? (
                                <Check
                                  size={15}
                                  className="text-[#6be49a]"
                                  aria-label="Incluído"
                                />
                              ) : v === false ? (
                                <Minus
                                  size={15}
                                  className="text-white/25"
                                  aria-label="Não incluído"
                                />
                              ) : (
                                <span className="text-sm">{v}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ / notes */}
        <section className="py-24">
          <div className="shell grid gap-10 md:grid-cols-2">
            <QNote
              q="Posso mudar de plano a qualquer momento?"
              a="Sim. Upgrade ou downgrade em qualquer altura — o valor é prorateado ao dia."
            />
            <QNote
              q="Há desconto para advocacia pro bono?"
              a="Sim. Gabinetes dedicados exclusivamente a pro bono têm 50% de desconto. Fala connosco."
            />
            <QNote
              q="Os preços incluem IVA?"
              a="Não. Todos os valores são apresentados antes de IVA, conforme prática angolana."
            />
            <QNote
              q="E se precisar de SSO ou SLA no plano Gabinete?"
              a="Podemos adicionar add-ons ao plano Gabinete caso não justifique o Pro Business. Contacto-nos para personalizar."
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function QNote({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="text-base font-medium text-white">{q}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{a}</p>
    </div>
  )
}
