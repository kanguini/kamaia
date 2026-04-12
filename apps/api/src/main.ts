import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Log as early as possible so we see output even if app crashes later
  console.log('[bootstrap] Starting Kamaia API...');
  console.log(`[bootstrap] Node ${process.version}, NODE_ENV=${process.env.NODE_ENV || 'unset'}`);
  console.log(`[bootstrap] PORT env: ${process.env.PORT || 'unset (will use APP_PORT or 3001)'}`);

  try {
    console.log('[bootstrap] Creating Nest application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    console.log('[bootstrap] Nest application created');

    const config = app.get(ConfigService);

    console.log('[bootstrap] Configuring helmet + CORS...');
    app.use(helmet());

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
      allowedHeaders: ['Content-Type', 'Authorization'],
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
