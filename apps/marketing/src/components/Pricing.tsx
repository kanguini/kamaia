/**
 * Pricing — secção de preços do marketing site.
 *
 * Sprint 4.4: server component que faz fetch ao endpoint público
 * GET /billing/plans. Esta é a única fonte da verdade para preços
 * — o mesmo endpoint serve o painel de billing dentro da app, o
 * marketing site, e em breve a integração com gateway.
 *
 * Vantagens vs hardcoded:
 *  - Quando alterarmos um preço, só muda no plans.config.ts da API
 *  - O painel dentro da app e o site ficam sincronizados
 *    automaticamente
 *  - Adicionar / esconder planos é trivial (toggle isPublic)
 *
 * Fallback se o endpoint falhar (e.g. API offline durante o
 * build): mostra mensagem discreta sem partir a página.
 */

import Link from 'next/link'
import { Reveal } from './Reveal'
import { appUrl } from '@/lib/utm'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'https://api.kamaia.cc'

interface Plan {
  plan: string
  label: string
  slug: string
  precoMensalCentavos: number
  tagline: string
  highlights: string[]
  isPublic: boolean
}

async function fetchPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${API_URL}/billing/plans`, {
      // Cache 1h. Tornar 0 quando integrarmos com gateway de
      // pagamento real e tivermos pricing dinâmico.
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data ?? []) as Plan[]
  } catch {
    return []
  }
}

function fmtAkz(centavos: number): string {
  if (centavos === 0) return 'Sob proposta'
  const akz = centavos / 100
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'AOA',
    maximumFractionDigits: 0,
  })
    .format(akz)
    .replace('AOA', 'AKZ')
}

export async function Pricing() {
  const plans = await fetchPlans()

  return (
    <section id="precos" className="relative py-32">
      <div className="shell">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-playfair text-[clamp(32px,4.4vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-white">
              Preços simples,
              <br />
              <em className="not-italic" style={{ color: '#9cb6ff' }}>
                alinhados com o teu volume.
              </em>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-white/70">
              Pagas pelo número de contratos activos e por créditos de IA
              consumidos. Mensagens do Dr. Kamaia grátis dentro do plano.
            </p>
          </div>
        </Reveal>

        {plans.length === 0 ? (
          <div className="mt-12 text-center text-white/50">
            Tabela de preços temporariamente indisponível. Contacta-nos para
            uma proposta personalizada.
          </div>
        ) : (
          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((p, i) => {
              const featured = p.plan === 'SCALE' // destacar o tier médio
              return (
                <Reveal key={p.plan} delay={i * 60}>
                  <article
                    className={
                      featured
                        ? 'relative flex h-full flex-col rounded-2xl border border-white/30 bg-white/10 p-7 backdrop-blur-sm shadow-[0_30px_80px_-30px_rgba(156,182,255,0.3)]'
                        : 'relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm'
                    }
                  >
                    {featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-black">
                        Mais escolhido
                      </span>
                    )}

                    <header>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                        {p.label}
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-playfair text-[28px] font-medium text-white">
                          {fmtAkz(p.precoMensalCentavos)}
                        </span>
                        {p.precoMensalCentavos > 0 && (
                          <span className="text-xs text-white/50">/ mês</span>
                        )}
                      </div>
                      <p className="mt-3 text-[13px] leading-relaxed text-white/65">
                        {p.tagline}
                      </p>
                    </header>

                    <ul className="mt-6 flex-1 space-y-2.5">
                      {p.highlights.map((h, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-[12.5px] leading-relaxed text-white/75"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-white/40"
                          />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={
                        p.precoMensalCentavos === 0
                          ? '/contacto'
                          : appUrl('/register', 'pricing', p.slug)
                      }
                      className={
                        featured
                          ? 'mt-7 inline-flex items-center justify-center rounded-md bg-white px-4 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]'
                          : 'mt-7 inline-flex items-center justify-center rounded-md border border-white/25 bg-white/5 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10'
                      }
                    >
                      {p.precoMensalCentavos === 0
                        ? 'Pedir proposta'
                        : 'Começar'}
                    </Link>
                  </article>
                </Reveal>
              )
            })}
          </div>
        )}

        <Reveal>
          <p className="mt-12 text-center text-xs text-white/50">
            Os preços estão em Kwanza (AKZ). Faturação mensal ou anual com
            10% de desconto. Sem fidelização — podes cancelar a qualquer
            momento.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
