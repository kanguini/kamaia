import { Controller, Get, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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

  @Post('reset-admin')
  async resetAdmin(@Body() body: { secret: string; newPassword: string }) {
    // Protection: must provide the JWT_SECRET as confirmation
    const jwtSecret = process.env.JWT_SECRET || '';
    if (!body.secret || body.secret !== jwtSecret) {
      throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    }

    if (!body.newPassword || body.newPassword.length < 8) {
      throw new HttpException({ error: 'Password too short' }, HttpStatus.BAD_REQUEST);
    }

    // Find the first SOCIO_GESTOR user
    const admin = await this.prisma.user.findFirst({
      where: { role: 'SOCIO_GESTOR', deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, gabineteId: true },
    });

    if (!admin) {
      throw new HttpException({ error: 'No admin found' }, HttpStatus.NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await this.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    return {
      success: true,
      admin: {
        email: admin.email,
        name: `${admin.firstName} ${admin.lastName}`,
        gabineteId: admin.gabineteId,
      },
    };
  }
}
