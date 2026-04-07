import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '@kamaia/shared-types';

export interface DashboardStats {
  activeProcessos: number;
  upcomingPrazos: number;
  activeClientes: number;
  aiQueriesRemaining: number;
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(gabineteId: string): Promise<DashboardStats> {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Count active processos
    const activeProcessos = await this.prisma.processo.count({
      where: {
        gabineteId,
        status: 'ACTIVO',
        deletedAt: null,
      },
    });

    // Count upcoming prazos (next 3 days)
    const upcomingPrazos = await this.prisma.prazo.count({
      where: {
        gabineteId,
        status: 'PENDENTE',
        dueDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
        deletedAt: null,
      },
    });

    // Count active clientes
    const activeClientes = await this.prisma.cliente.count({
      where: {
        gabineteId,
        isActive: true,
        deletedAt: null,
      },
    });

    // Get usage quota and calculate AI queries remaining
    const gabinete = await this.prisma.gabinete.findUnique({
      where: { id: gabineteId },
      select: {
        plan: true,
        usageQuota: {
          select: {
            aiQueriesUsed: true,
          },
        },
      },
    });

    let aiQueriesRemaining = 0;
    if (gabinete) {
      const planLimit = PLAN_LIMITS[gabinete.plan as keyof typeof PLAN_LIMITS].aiQueries;
      const usedQueries = gabinete.usageQuota?.aiQueriesUsed || 0;

      if (planLimit === -1) {
        aiQueriesRemaining = -1; // unlimited
      } else {
        aiQueriesRemaining = Math.max(0, planLimit - usedQueries);
      }
    }

    return {
      activeProcessos,
      upcomingPrazos,
      activeClientes,
      aiQueriesRemaining,
    };
  }
}
