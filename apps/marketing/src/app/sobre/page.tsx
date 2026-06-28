import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Server, FileLock, Globe2 } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'

export const metadata: Metadata = {
  title: 'Sobre · Kamaia CLM',
  description:
    'O Kamaia é um sistema de gestão do ciclo de vida de contratos construído em Angola, para Angola e o PALOP. Compliance angolano embebido e um conselheiro de IA sobre a legislação local.',
  alternates: { canonical: '/sobre' },
  openGraph: {
    title: 'Sobre · Kamaia CLM',
    description:
      'A visão, a arquitectura e o porquê de um CLM construído em Angola.',
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
                Construído em Angola,
                <br />
                <em className="not-italic" style={{ color: '#9cb6ff' }}>
                  à medida de Angola.
                </em>
              </h1>
              <p className="mt-6 max-w-[680px] text-[15px] leading-relaxed text-white/65">
                O Kamaia é um sistema de gestão do ciclo de vida de contratos.
                Foi desenhado para qualquer organização que viva de contratos em
                Angola — imobiliário, indústria, banca, comércio, serviços — e
                acompanha cada contrato, criado de raiz ou herdado, do primeiro
                acto ao último.
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
                    Os grandes sistemas internacionais de gestão de contratos não
                    conhecem o Código do Imposto de Selo, não sabem qual a verba
                    da TGIS aplicável a um arrendamento, não interpretam a Lei
                    Cambial e não leem português de Angola. O compliance do país
                    fica, na melhor das hipóteses, do lado de fora.
                  </p>
                </div>
                <div>
                  <p className="text-[15px] leading-relaxed text-white/70">
                    Os sistemas locais, por sua vez, não fazem gestão de ciclo de
                    vida. O Kamaia ocupa este espaço — ambição global, substância
                    angolana. Aqui, o compliance do país não é um acessório: é
                    parte da estrutura, e por isso uma vantagem real do produto.
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
                Uma arquitectura que se defende.
              </h2>
              <div className="mt-10 grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2">
                <Pillar
                  icon={Server}
                  title="Regras de compliance versionadas"
                  body="As regras de compliance são código versionado, não lógica dispersa. Aplica-se a lei vigente à data do facto tributário — não a de hoje. Cada acto é sugerido pelo sistema e confirmado pela equipa."
                />
                <Pillar
                  icon={FileLock}
                  title="Registo de auditoria imutável"
                  body="Cada escrita fica registada com autor, estado anterior e posterior, e contexto. Prova de integridade e controlo interno desde o primeiro dia."
                />
                <Pillar
                  icon={Globe2}
                  title="Localização profunda"
                  body="Português de Angola em toda a interface, datas no fuso do país, catálogo de tipos com o vocabulário local e suporte multi-moeda com taxa de referência convertível."
                />
                <Pillar
                  icon={Shield}
                  title="Isolamento e escala"
                  body="Isolamento por organização em todas as camadas, com estrutura para grupos com vários departamentos — ou para um escritório que gere a carteira de vários clientes, cada um separado e auditável."
                />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="shell text-center">
            <Reveal>
              <h2 className="font-playfair text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15]">
                Estamos a falar com as primeiras organizações.
              </h2>
              <p className="mx-auto mt-5 max-w-[580px] text-[15px] leading-relaxed text-white/60">
                Se a sua organização tem uma carteira de contratos para pôr em
                ordem, fale connosco. O percurso do produto segue conversas
                reais.
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
