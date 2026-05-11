// Carregado pelo Next.js no browser. Noop se NEXT_PUBLIC_SENTRY_DSN não definido.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    tracesSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1',
    ),
    // Replay: 0 por agora — desliga reanimação de sessão até definirmos
    // política de privacidade explícita para o utilizador final.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}
