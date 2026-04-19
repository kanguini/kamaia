'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { submitContact, type ContactInput, type ContactResult } from './action'

export function ContactForm({ initialPlan }: { initialPlan?: string }) {
  const [form, setForm] = useState<ContactInput>({
    name: '',
    email: '',
    phone: '',
    gabinete: '',
    message: '',
    plan: initialPlan,
  })
  const [result, setResult] = useState<ContactResult | null>(null)
  const [pending, startTransition] = useTransition()

  const update = (key: keyof ContactInput) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    startTransition(async () => {
      const r = await submitContact(form)
      setResult(r)
      if (r.ok) {
        setForm({ name: '', email: '', phone: '', gabinete: '', message: '', plan: initialPlan })
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
          escreve directamente para hello@kamaia.ao.
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
        <Field
          label="Nome *"
          error={result?.fieldErrors?.name}
        >
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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? 'A enviar…' : 'Enviar mensagem'}
      </button>

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
      <span className="block text-[11px] font-medium uppercase tracking-[0.1em] text-white/55 mb-1.5">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#e46b7a]">{error}</span>}
    </label>
  )
}
