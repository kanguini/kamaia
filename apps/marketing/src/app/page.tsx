import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AnimatedGradient } from '@/components/AnimatedGradient'

/**
 * Sprint 0 landing placeholder.
 *
 * Minimal "coming soon" page carrying the Kamaia 2.0 identity end-to-end:
 * wordmark, slogan, animated gradient, access shortcut for existing users.
 * Replaced in Sprint 1 with the full home page.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <AnimatedGradient />

      {/* Top bar — logo only, sits above the gradient */}
      <header className="relative z-10 shell flex items-center justify-between py-6">
        <Logo height={24} className="text-white" />
        <Link
          href="https://app.kamaia.ao/login"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          Entrar
        </Link>
      </header>

      {/* Hero — slogan + two CTAs + status note */}
      <section className="relative z-10 shell flex min-h-[calc(100vh-96px)] flex-col justify-center pb-16 pt-8 text-white">
        <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/70 backdrop-blur-sm">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: '#6be49a' }}
          />
          Site em construção · Aplicação em produção
        </span>

        <h1 className="max-w-4xl text-[clamp(36px,6vw,72px)] font-medium leading-[1.05] tracking-[-0.025em]">
          Gestão jurídica inteligente,
          <br />
          <span style={{ color: '#9cb6ff' }}>
            Pessoas, Processos e Tecnologia
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-[clamp(15px,1.6vw,18px)] leading-relaxed text-white/80">
          A plataforma feita para advogados angolanos. Processos, prazos,
          timesheets e facturação num só lugar. Com assistente IA que redige
          peças.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="https://app.kamaia.ao/register"
            className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02] hover:bg-white/95"
          >
            Começar grátis
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="#contacto"
            className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Agendar demo
          </Link>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 text-[11px] uppercase tracking-[0.1em] text-white/50">
          <span>AKZ · Feriados angolanos</span>
          <span>Dias úteis automáticos</span>
          <span>Audit log append-only</span>
          <span>Multi-tenant isolado</span>
        </div>
      </section>

      {/* Foot note — discreet, above the gradient */}
      <footer className="relative z-10 shell pb-8 text-xs text-white/45">
        © {new Date().getFullYear()} Kamaia · Gestão jurídica inteligente
      </footer>
    </main>
  )
}
