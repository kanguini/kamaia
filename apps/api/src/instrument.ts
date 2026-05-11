// IMPORTANT: must be the FIRST import of the application (carrega antes
// de qualquer outro módulo) — instrumenta http, prisma, etc.
// Carregado via `node --import ./dist/instrument.js dist/main.js` ou
// importado no topo de main.ts antes de qualquer outro import.
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Sample rate baixa em produção — trace de cada request seria caro.
    // Ajustar SENTRY_TRACES_SAMPLE_RATE no env var para mais granularidade.
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1',
    ),
    // Não captura PII por default — gabineteId / userId são suficientes
    // para correlação sem expor emails/passwords.
    sendDefaultPii: false,
    // Filtra erros já tratados pelo Result<T> pattern (não-throws).
    beforeSend(event, hint) {
      const err = hint.originalException as Error | undefined;
      if (err?.message?.includes('Invalid credentials')) return null;
      return event;
    },
  });
  // Log para confirmar wiring (visível em Railway logs).
  // eslint-disable-next-line no-console
  console.log(`[sentry] initialized — env=${process.env.NODE_ENV || 'development'}`);
} else {
  // eslint-disable-next-line no-console
  console.log('[sentry] disabled — SENTRY_DSN not set (noop mode)');
}
