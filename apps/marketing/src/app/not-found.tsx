import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AnimatedGradient } from '@/components/AnimatedGradient'

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <AnimatedGradient />
      <div className="relative z-10 shell flex flex-1 flex-col justify-center py-16 text-neutral-900">
        <Link href="/" aria-label="Início">
          <Logo height={22} />
        </Link>
        <div className="mt-20">
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
            Erro 404
          </span>
          <h1 className="mt-3 text-[clamp(44px,7vw,96px)] font-medium leading-[0.95] tracking-[-0.03em]">
            Página não
            <br />
            encontrada.
          </h1>
          <p className="mt-6 max-w-lg text-neutral-600">
            A rota que procuras não existe ou foi movida. Podemos levar-te a
            um dos destinos habituais.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-all hover:scale-[1.02]"
            >
              Voltar ao início
            </Link>
            <Link
              href="/funcionalidades"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-900 backdrop-blur-sm transition-colors hover:bg-neutral-100"
            >
              Ver funcionalidades
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-900 backdrop-blur-sm transition-colors hover:bg-neutral-100"
            >
              Contacto
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
