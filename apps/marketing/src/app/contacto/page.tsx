import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { Mail, Phone, MessageCircle, Calendar } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { ContactForm } from './ContactForm'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Fale connosco para candidatar o seu escritório ao programa de early access, agendar uma demonstração ou esclarecer qualquer questão técnica sobre o Kamaia.',
  alternates: { canonical: '/contacto' },
  openGraph: {
    title: 'Contacto · Kamaia',
    description:
      'Candidate-se ao early access ou agende uma demonstração da plataforma.',
    url: '/contacto',
    type: 'website',
  },
}

export default function ContactoPage({
  searchParams,
}: {
  searchParams?: { plan?: string }
}) {
  const initialPlan = searchParams?.plan

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit"
          strategy="afterInteractive"
          async
          defer
        />
      )}
      <Nav />
      <main className="bg-white text-neutral-900">
        <section className="border-b border-neutral-200 py-24">
          <div className="shell">
            <Reveal>
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                Contacto
              </span>
              <h1 className="mt-3 max-w-3xl text-[clamp(36px,5vw,56px)] font-medium leading-[1.05] tracking-[-0.025em]">
                Fale connosco.
                <br />
                <span style={{ color: '#9cb6ff' }}>Respondemos num dia útil.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-neutral-600">
                Questões sobre preços, sobre como trazer a carteira que já tem,
                ou um pedido de demonstração privada — respondemos pessoalmente.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="py-20">
          <div className="shell grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal>
              <ContactForm initialPlan={initialPlan} />
            </Reveal>

            <Reveal delay={0.08}>
              <aside className="space-y-4">
                <ChannelCard
                  icon={Mail}
                  title="Email"
                  value="hello@kamaia.cc"
                  href="mailto:hello@kamaia.cc"
                  hint="Resposta em até 1 dia útil"
                />
                <ChannelCard
                  icon={MessageCircle}
                  title="WhatsApp"
                  value="+244 923 000 000"
                  href="https://wa.me/244923000000?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20Kamaia"
                  hint="Mais rápido para perguntas curtas"
                />
                <ChannelCard
                  icon={Calendar}
                  title="Agendar demo"
                  value="Reserva 30 minutos"
                  href="https://cal.com/kamaia/demo"
                  hint="Demo privada em vídeo-chamada"
                />
                <ChannelCard
                  icon={Phone}
                  title="Morada"
                  value="Luanda, Angola"
                  hint="Visita por marcação"
                />

                <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                    Já tem conta?
                  </p>
                  <Link
                    href="https://app.kamaia.cc/login"
                    className="mt-2 inline-block text-neutral-900 underline underline-offset-4"
                  >
                    Entre em app.kamaia.cc →
                  </Link>
                </div>
              </aside>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function ChannelCard({
  icon: Icon,
  title,
  value,
  href,
  hint,
}: {
  icon: typeof Mail
  title: string
  value: string
  href?: string
  hint?: string
}) {
  const inner = (
    <div className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5 transition-colors hover:border-neutral-300">
      <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
        <Icon size={16} className="text-neutral-700" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.1em] text-neutral-500">
          {title}
        </div>
        <div className="mt-1 text-[15px] font-medium text-neutral-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
      </div>
    </div>
  )
  if (href) {
    return (
      <Link
        href={href}
        target={href.startsWith('http') || href.startsWith('mailto') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener' : undefined}
        className="block"
      >
        {inner}
      </Link>
    )
  }
  return inner
}
