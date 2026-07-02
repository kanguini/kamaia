import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
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

    const body = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      // Redis é opcional por design (as queues caem para processamento
      // inline sem ele) — não derruba o healthcheck.
      responseTime: `${Date.now() - startedAt}ms`,
      environment: process.env.NODE_ENV || 'development',
    };

    // Auditoria: com DB em baixo devolvíamos 200 {degraded} — o
    // healthcheck do Railway só olha ao status code, e um deploy com
    // DATABASE_URL partido passava e SUBSTITUÍA o deploy bom. 503
    // mantém o deployment anterior a servir.
    if (dbStatus !== 'ok') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
