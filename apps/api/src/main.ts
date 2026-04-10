import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  // Support multiple CORS origins (comma-separated FRONTEND_URL)
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const allowedOrigins = frontendUrl.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, same-origin)
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

  // Railway sets PORT, local dev uses APP_PORT, fallback 3001
  const port = parseInt(
    process.env.PORT || config.get<string>('APP_PORT') || '3001',
    10,
  );

  await app.listen(port, '0.0.0.0');

  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`[Kamaia API] Running on port ${port} (${nodeEnv})`);
}

bootstrap();
