import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AnimatedGradient } from '@/components/AnimatedGradient'

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <AnimatedGradient />
      <div className="relative z-10 shell flex flex-1 flex-col justify-center py-16 text-white">
        <Link href="/" aria-label="Início">
          <Logo height={22} />
        </Link>
        <div className="mt-20">
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            Erro 404
          </span>
          <h1 className="mt-3 text-[clamp(44px,7vw,96px)] font-medium leading-[0.95] tracking-[-0.03em]">
            Página não
            <br />
            encontrada.
          </h1>
          <p className="mt-6 max-w-lg text-white/75">
            A rota que procuras não existe ou foi movida. Podemos levar-te a
            um dos destinos habituais.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Voltar ao início
            </Link>
            <Link
              href="/funcionalidades"
              className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Ver funcionalidades
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Contacto
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
