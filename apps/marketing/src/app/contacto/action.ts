'use server'

import { Resend } from 'resend'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  gabinete: z.string().optional(),
  message: z.string().min(10, 'Escreve pelo menos 10 caracteres'),
  plan: z.string().optional(),
})

export type ContactInput = z.infer<typeof contactSchema>

export interface ContactResult {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ContactInput, string>>
}

const NOTIFY = process.env.CONTACT_NOTIFY_EMAIL || 'heldermaiato@outlook.com'

export async function submitContact(input: ContactInput): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ContactInput, string>> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactInput
      fieldErrors[key] = issue.message
    }
    return { ok: false, error: 'Dados inválidos', fieldErrors }
  }
  const data = parsed.data
  const key = process.env.RESEND_API_KEY

  // In dev without the key, log to console so the flow can still be tested.
  if (!key) {
    // eslint-disable-next-line no-console
    console.log('[contact] Resend key missing — would have sent:', data)
    return { ok: true }
  }

  const resend = new Resend(key)
  try {
    const subject = `[Kamaia] Novo contacto de ${data.name}`
    const html = `
      <h2>Novo contacto do site</h2>
      <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">
        <tr><td><strong>Nome</strong></td><td>${escape(data.name)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escape(data.email)}</td></tr>
        ${data.phone ? `<tr><td><strong>Telefone</strong></td><td>${escape(data.phone)}</td></tr>` : ''}
        ${data.gabinete ? `<tr><td><strong>Gabinete</strong></td><td>${escape(data.gabinete)}</td></tr>` : ''}
        ${data.plan ? `<tr><td><strong>Plano interessado</strong></td><td>${escape(data.plan)}</td></tr>` : ''}
      </table>
      <h3>Mensagem</h3>
      <p style="white-space:pre-wrap">${escape(data.message)}</p>
    `.trim()

    await resend.emails.send({
      from: 'Kamaia <hello@kamaia.cc>',
      to: NOTIFY,
      replyTo: data.email,
      subject,
      html,
    })
    return { ok: true }
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[contact] Resend failed', err)
    return {
      ok: false,
      error:
        'Não foi possível enviar a mensagem. Tenta novamente ou escreve para hello@kamaia.cc.',
    }
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
