import { Controller, Get, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      responseTime: `${Date.now() - startedAt}ms`,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Post('fix-migrations')
  async fixMigrations() {
    try {
      // Check if _prisma_migrations table exists
      const tables = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='_prisma_migrations'`,
      );

      if (tables.length === 0) {
        // Create the table and mark both migrations as applied
        await this.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
            "id" VARCHAR(36) NOT NULL,
            "checksum" VARCHAR(64) NOT NULL,
            "finished_at" TIMESTAMPTZ,
            "migration_name" VARCHAR(255) NOT NULL,
            "logs" TEXT,
            "rolled_back_at" TIMESTAMPTZ,
            "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
          )
        `);
      }

      // Mark migrations as applied
      for (const name of ['0001_baseline', '0002_lifecycle_tags_interactions']) {
        const exists = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM _prisma_migrations WHERE migration_name = $1`,
          name,
        );
        if (exists.length === 0) {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
             VALUES (gen_random_uuid(), 'manual', now(), $1, 1)`,
            name,
          );
        }
      }

      const migs = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`,
      );
      return { fixed: true, migrations: migs };
    } catch (e) {
      return { fixed: false, error: (e as Error).message };
    }
  }
}
