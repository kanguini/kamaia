'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  gabinete: z.string().optional(),
  message: z.string().min(10, 'Escreve pelo menos 10 caracteres'),
  plan: z.string().optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Tens de aceitar a política de privacidade' }),
  }),
  turnstileToken: z.string().min(1, 'Verificação anti-bot obrigatória'),
})

export type ContactInput = z.infer<typeof contactSchema>

export interface ContactResult {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ContactInput, string>>
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'https://api.kamaia.cc'

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

  try {
    const h = headers()
    const forwarded =
      h.get('cf-connecting-ip') ||
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      ''
    const ua = h.get('user-agent') || ''

    const res = await fetch(`${API_URL}/public-contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Passa o IP/UA reais ao API para audit/rate-limit.
        ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
        ...(ua ? { 'user-agent': ua } : {}),
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    })

    if (res.ok) {
      return { ok: true }
    }

    // Rate limit
    if (res.status === 429) {
      return {
        ok: false,
        error:
          'Enviaste demasiadas mensagens num curto espaço de tempo. Tenta de novo dentro de uma hora ou escreve para hello@kamaia.cc.',
      }
    }

    let message =
      'Não foi possível enviar a mensagem. Tenta novamente ou escreve para hello@kamaia.cc.'
    try {
      const payload = await res.json()
      if (payload?.message && typeof payload.message === 'string') {
        message = payload.message
      } else if (payload?.code === 'CAPTCHA_FAILED' || payload?.code === 'CAPTCHA_ERROR') {
        message = 'Verificação anti-bot falhou. Recarrega a página e tenta de novo.'
      }
    } catch {
      // ignore body parse errors
    }
    return { ok: false, error: message }
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[contact] submit failed', err)
    return {
      ok: false,
      error:
        'Não foi possível contactar o servidor. Tenta novamente ou escreve para hello@kamaia.cc.',
    }
  }
}
