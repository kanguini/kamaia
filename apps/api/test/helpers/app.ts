import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

/**
 * Boots a full Nest application for e2e testing. The `/api` prefix
 * matches main.ts so supertest paths read the same as production.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  // Note: the app uses ParseZodPipe per-handler (not class-validator),
  // so no global ValidationPipe is needed here.
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    close: async () => {
      await app.close();
    },
  };
}
