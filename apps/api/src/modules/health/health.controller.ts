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

  /** Temporary: upgrade all gabinetes to PRO_BUSINESS trial */
  @Post('activate-trial')
  async activateTrial() {
    const result = await this.prisma.gabinete.updateMany({
      where: { plan: 'FREE' },
      data: { plan: 'PRO_BUSINESS' },
    });

    return {
      upgraded: result.count,
      plan: 'PRO_BUSINESS',
      trial: '3 meses gratuito',
      message: `${result.count} gabinete(s) upgraded to PRO_BUSINESS`,
    };
  }
}
