'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { submitContact, type ContactInput, type ContactResult } from './action'

type FormState = {
  name: string
  email: string
  phone: string
  gabinete: string
  message: string
  plan?: string
  consent: boolean
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact' | 'invisible'
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

export function ContactForm({ initialPlan }: { initialPlan?: string }) {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    gabinete: '',
    message: '',
    plan: initialPlan,
    consent: false,
  })
  const [token, setToken] = useState<string>('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const [result, setResult] = useState<ContactResult | null>(null)
  const [pending, startTransition] = useTransition()
  const widgetRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Render Cloudflare Turnstile when the script is ready.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      // Dev without site-key: skip captcha and stamp a sentinel token.
      setToken('dev-no-captcha')
      setCaptchaReady(true)
      return
    }

    let cancelled = false

    const render = () => {
      if (cancelled) return
      if (!window.turnstile || !containerRef.current) return
      if (widgetRef.current) return
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (t: string) => {
          setToken(t)
          setCaptchaReady(true)
        },
        'error-callback': () => {
          setToken('')
          setCaptchaReady(false)
        },
        'expired-callback': () => {
          setToken('')
          setCaptchaReady(false)
        },
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const prev = window.onTurnstileLoad
      window.onTurnstileLoad = () => {
        prev?.()
        render()
      }
    }

    return () => {
      cancelled = true
      try {
        if (widgetRef.current && window.turnstile) {
          window.turnstile.remove(widgetRef.current)
        }
      } catch {
        // noop
      }
      widgetRef.current = null
    }
  }, [])

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)

    if (!form.consent) {
      setResult({
        ok: false,
        error: 'Tens de aceitar a política de privacidade para enviar a mensagem.',
      })
      return
    }
    if (!token) {
      setResult({
        ok: false,
        error:
          'Verificação anti-bot ainda não carregou. Aguarda 1–2 segundos e tenta de novo.',
      })
      return
    }

    startTransition(async () => {
      const payload: ContactInput = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        gabinete: form.gabinete || undefined,
        message: form.message,
        plan: form.plan,
        consent: true as const,
        turnstileToken: token,
      }
      const r = await submitContact(payload)
      setResult(r)
      if (r.ok) {
        setForm({
          name: '',
          email: '',
          phone: '',
          gabinete: '',
          message: '',
          plan: initialPlan,
          consent: false,
        })
        // Reset captcha after success to get a fresh token for next send.
        try {
          if (widgetRef.current && window.turnstile) {
            window.turnstile.reset(widgetRef.current)
            setToken('')
            setCaptchaReady(false)
          }
        } catch {
          // noop
        }
      }
    })
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-[#6be49a]/30 bg-[#6be49a]/5 p-6">
        <CheckCircle2 size={24} className="text-[#6be49a]" />
        <h3 className="mt-3 text-lg font-medium text-white">Mensagem enviada</h3>
        <p className="mt-2 text-sm text-white/70">
          Recebemos o teu contacto. Respondemos em 1 dia útil. Se for urgente,
          escreve directamente para hello@kamaia.cc.
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-5 text-sm text-white/60 underline underline-offset-4 hover:text-white"
        >
          Enviar outra mensagem
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {result && !result.ok && result.error && (
        <div className="flex items-start gap-3 rounded-lg border border-[#e46b7a]/30 bg-[#e46b7a]/10 p-4 text-sm text-white">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-[#e46b7a]" />
          <span>{result.error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *" error={result?.fieldErrors?.name}>
          <input
            type="text"
            value={form.name}
            onChange={update('name')}
            required
            className="k2-input"
            autoComplete="name"
          />
        </Field>
        <Field label="Email *" error={result?.fieldErrors?.email}>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            required
            className="k2-input"
            autoComplete="email"
          />
        </Field>
        <Field label="Telefone">
          <input
            type="tel"
            value={form.phone}
            onChange={update('phone')}
            placeholder="+244 ..."
            className="k2-input"
            autoComplete="tel"
          />
        </Field>
        <Field label="Gabinete">
          <input
            type="text"
            value={form.gabinete}
            onChange={update('gabinete')}
            className="k2-input"
            autoComplete="organization"
          />
        </Field>
      </div>

      <Field label="Mensagem *" error={result?.fieldErrors?.message}>
        <textarea
          value={form.message}
          onChange={update('message')}
          rows={5}
          required
          placeholder="Conta-nos o que precisas — queres demo, tens dúvidas sobre preços, migração do Excel..."
          className="k2-input resize-y min-h-[120px]"
        />
      </Field>

      {/* Consentimento RGPD / Lei 22/11 de Angola */}
      <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/75">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-white"
          required
        />
        <span className="leading-relaxed">
          Autorizo o Kamaia a tratar os meus dados de contacto para responder a
          esta mensagem, em conformidade com a{' '}
          <Link
            href="/politica-privacidade"
            className="underline underline-offset-4 hover:text-white"
          >
            Política de Privacidade
          </Link>{' '}
          e a Lei n.º 22/11 de Angola. Posso pedir a remoção dos meus dados a
          qualquer momento.
        </span>
      </label>

      {/* Cloudflare Turnstile — widget invisível/managed */}
      {TURNSTILE_SITE_KEY ? (
        <div ref={containerRef} className="cf-turnstile" />
      ) : (
        <p className="text-xs text-white/40">
          (Verificação anti-bot desactivada em desenvolvimento.)
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !form.consent || (!!TURNSTILE_SITE_KEY && !captchaReady)}
        className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? 'A enviar…' : 'Enviar mensagem'}
      </button>

      <p className="text-xs text-white/40">
        Os dados são guardados em servidores protegidos e usados exclusivamente
        para te responder. Não partilhamos nem vendemos informação a terceiros.
      </p>

      <style jsx>{`
        .k2-input {
          width: 100%;
          padding: 10px 12px;
          background: var(--k2-bg);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          font-size: 14px;
          font-family: inherit;
          transition: border-color 120ms, box-shadow 120ms;
        }
        .k2-input:focus {
          outline: none;
          border-color: var(--k2-accent);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--k2-accent) 20%, transparent);
        }
        .k2-input::placeholder {
          color: var(--k2-text-mute);
        }
      `}</style>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/55">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#e46b7a]">{error}</span>}
    </label>
  )
}
