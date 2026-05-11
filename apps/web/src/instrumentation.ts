// Next.js 13+ instrumentation hook. Carrega o Sentry server/edge config
// no boot do server. Documentação:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
