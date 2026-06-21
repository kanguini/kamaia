import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Server, FileLock, Globe2 } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'

export const metadata: Metadata = {
  title: 'Sobre · Kamaia CLM',
  description:
    'Kamaia é um Contract Lifecycle Management horizontal, construído em Angola para Angola e PALOP. Compliance angolano embebido. IA sobre a legislação local.',
  alternates: { canonical: '/sobre' },
  openGraph: {
    title: 'Sobre · Kamaia CLM',
    description:
      'A visão, a arquitectura e o porquê de existir um CLM construído em Angola.',
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
                Sobre o Kamaia
              </span>
              <h1 className="mt-4 font-playfair text-[clamp(36px,5vw,64px)] font-medium leading-[1.1]">
                Construído em Angola para
                <br />
                <em className="not-italic" style={{ color: '#9cb6ff' }}>
                  resolver problemas de Angola.
                </em>
              </h1>
              <p className="mt-6 max-w-[680px] text-[15px] leading-relaxed text-white/65">
                O Kamaia é um Contract Lifecycle Management horizontal. Está
                desenhado para qualquer organização que tenha contratos em
                Angola — imobiliária, indústria, banca, comércio, serviços —
                e para as sociedades de advogados que cuidam da carteira dos
                seus clientes corporativos.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="border-b border-white/5 py-24">
          <div className="shell">
            <Reveal>
              <h2 className="font-playfair text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15]">
                Porquê construir aqui.
              </h2>
              <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-2">
                <div>
                  <p className="text-[15px] leading-relaxed text-white/70">
                    Os grandes CLMs internacionais — Ironclad, ContractWorks,
                    LinkSquares, SpotDraft — não conhecem o Código do Imposto
                    de Selo. Não sabem o que é a verba TGIS aplicável a um
                    arrendamento. Não falam com a BNA. Não interpretam o RJOC.
                    Não lêem PT-AO.
                  </p>
                </div>
                <div>
                  <p className="text-[15px] leading-relaxed text-white/70">
                    Os sistemas locais não fazem CLM. O Kamaia preenche este
                    espaço — software global em ambição, angolano em substância.
                    O compliance angolano não é um plugin: é a coluna vertebral.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-b border-white/5 py-24">
          <div className="shell">
            <Reveal>
              <h2 className="font-playfair text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15]">
                Arquitectura defensável.
              </h2>
              <div className="mt-10 grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2">
                <Pillar
                  icon={Shield}
                  title="Multi-tenancy hierárquico"
                  body="Tenants podem ter sub-tenants. Sociedades de advogados gerem N clientes isolados num só interface. Cada cliente é um tenant — auditável, separável, exportável."
                />
                <Pillar
                  icon={FileLock}
                  title="Audit log append-only"
                  body="Toda a escrita é registada com actor, antes/depois e contexto. Defesa legal e compliance interno fora da caixa. Audit cruzado para Modo AGENCY."
                />
                <Pillar
                  icon={Server}
                  title="Engine declarativo"
                  body="As regras de compliance são código versionado, não lógica espalhada por services. A regra vigente à data do facto tributário é a que se aplica — não a data presente."
                />
                <Pillar
                  icon={Globe2}
                  title="Localização profunda"
                  body="pt-AO em todas as labels. Datas UTC → WAT. Catálogo de tipos cobre o vocabulário forense angolano. Multi-moeda com taxa de referência convertível."
                />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="shell text-center">
            <Reveal>
              <h2 className="font-playfair text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15]">
                Estamos a falar com early adopters.
              </h2>
              <p className="mx-auto mt-5 max-w-[580px] text-[15px] leading-relaxed text-white/60">
                Se tens uma carteira de contratos para ordenar, conta-nos. O
                roadmap segue conversas reais — não decisões de gabinete.
              </p>
              <div className="mt-8">
                <Link
                  href="/contacto"
                  className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
                >
                  Falar com a equipa
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

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType
  title: string
  body: string
}) {
  return (
    <article className="bg-black p-7">
      <Icon className="h-6 w-6 text-white/70" aria-hidden="true" />
      <h3 className="mt-4 font-playfair text-xl font-medium text-white">
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-white/60">{body}</p>
    </article>
  )
}
