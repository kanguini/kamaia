import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'

export const metadata: Metadata = {
  title: 'Preços · em breve',
  description:
    'Os planos Kamaia estão a ser finalizados em diálogo com o programa de early adopters. Contacte-nos para integrar o programa.',
  robots: { index: false, follow: false },
}

export default function PrecosPage() {
  return (
    <>
      <Nav />
      <main className="bg-black text-white">
        <section className="border-b border-white/5 py-28 lg:py-36">
          <div className="shell text-center">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                Planos
              </span>
              <h1 className="mx-auto mt-3 max-w-3xl font-playfair text-[clamp(36px,5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
                Em definição.
                <br />
                <span style={{ color: '#9cb6ff' }}>Construídos com o mercado.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-white/75 leading-relaxed">
                Os planos Kamaia estão a ser desenhados em diálogo com o
                programa de early adopters — advogados, escritórios e
                departamentos jurídicos que definem o valor real da
                plataforma. Durante esta fase, o acesso é concedido a
                convite.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Link
                  href="/contacto"
                  className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
                >
                  Falar connosco
                </Link>
                <Link
                  href="/funcionalidades"
                  className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                >
                  Ver capacidades
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
