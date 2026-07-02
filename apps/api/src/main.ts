// Sentry must be imported BEFORE @nestjs/core / @prisma/client so the
// SDK instruments their internals. `instrument` calls Sentry.init when
// SENTRY_DSN is set (otherwise noop).
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Global BigInt → string serializer. Os valores monetários são guardados
// em BigInt (centavos) e o serializador padrão JSON throwa em BigInt.
// Express usa JSON.stringify directamente, por isso o shim tem de ser
// no prototype antes de qualquer handler responder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  // Log as early as possible so we see output even if app crashes later
  console.log('[bootstrap] Starting Kamaia API...');
  console.log(`[bootstrap] Node ${process.version}, NODE_ENV=${process.env.NODE_ENV || 'unset'}`);
  console.log(`[bootstrap] PORT env: ${process.env.PORT || 'unset (will use APP_PORT or 3001)'}`);

  try {
    console.log('[bootstrap] Creating Nest application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
      // Body limit aumentado de 100KB (default Express) para 25MB
      // — documents upload via base64 com PDF grande facilmente excede 100KB.
      bodyParser: false,
    });
    console.log('[bootstrap] Nest application created');

    const config = app.get(ConfigService);

    console.log('[bootstrap] Configuring helmet + CORS...');
    app.use(helmet());

    // Atrás do proxy do Railway/Vercel, `req.ip` sem isto é o IP do edge —
    // o ThrottlerGuard passa a partilhar UM bucket para todos os
    // utilizadores (dois utilizadores activos → 429 em cascata). Com
    // trust proxy = 1, o Express lê o X-Forwarded-For do proxy imediato.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);

    // ─── Body parsers ─────────────────────────────────────────
    // Documents upload em base64 + import lote com metadata grande
    // requerem mais do que os 100KB default. 25MB cobre PDFs típicos
    // de contrato (a maioria <5MB). Acima disto, multipart streaming.
    app.use(json({ limit: '25mb' }));
    app.use(urlencoded({ limit: '25mb', extended: true }));

    const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const allowedOrigins = frontendUrl.split(',').map((o) => o.trim());
    console.log(`[bootstrap] CORS allowed origins: ${allowedOrigins.join(', ')}`);

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // CRÍTICO: X-Tenant-Id é enviado por todos os requests autenticados
      // do frontend. Sem ele no preflight, o browser bloqueia 100% das
      // chamadas autenticadas (resultado: app aparece em branco após login).
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Tenant-Id',
        'X-Requested-With',
      ],
      exposedHeaders: [
        'X-Kamaia-Delivery',
        'X-Kamaia-Backup-Id',
        'X-Kamaia-Backup-Size',
      ],
      maxAge: 86400,  // 24h cache do preflight
    });

    app.setGlobalPrefix('api');
    console.log('[bootstrap] Global prefix /api set');

    const port = parseInt(
      process.env.PORT || config.get<string>('APP_PORT') || '3001',
      10,
    );

    console.log(`[bootstrap] Binding to 0.0.0.0:${port}...`);
    await app.listen(port, '0.0.0.0');

    console.log(`[bootstrap] ✅ Kamaia API listening on 0.0.0.0:${port} (${process.env.NODE_ENV || 'development'})`);
  } catch (err) {
    console.error('[bootstrap] ❌ FATAL: Failed to start Kamaia API');
    console.error(err);
    process.exit(1);
  }
}

bootstrap();
