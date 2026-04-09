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

  async getRentabilidade(gabineteId: string, processoId?: string) {
    // Get time entries
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        ...(processoId ? { processoId } : {}),
      },
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
            feeType: true,
            feeAmount: true,
          },
        },
      },
    });

    // Get expenses
    const expenses = await this.prisma.expense.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        ...(processoId ? { processoId } : {}),
      },
    });

    // Calculate per-processo
    const processoMap = new Map<string, any>();
    for (const entry of timeEntries) {
      const pid = entry.processoId;
      if (!processoMap.has(pid)) {
        processoMap.set(pid, {
          processoNumber: entry.processo.processoNumber,
          titulo: entry.processo.title,
          feeType: entry.processo.feeType,
          feeAmount: entry.processo.feeAmount,
          totalMinutes: 0,
          billableMinutes: 0,
          totalExpenses: 0,
        });
      }
      const p = processoMap.get(pid);
      p.totalMinutes += entry.durationMinutes;
      if (entry.billable) p.billableMinutes += entry.durationMinutes;
    }

    for (const exp of expenses) {
      if (!processoMap.has(exp.processoId)) continue;
      processoMap.get(exp.processoId).totalExpenses += exp.amount;
    }

    // Calculate values
    let totalHoras = 0,
      totalBillable = 0,
      valorHoras = 0,
      totalDespesas = 0;
    const porProcesso = [];
    for (const [pid, p] of processoMap) {
      const horasValue =
        p.feeType === 'HORA' && p.feeAmount
          ? Math.round((p.billableMinutes / 60) * p.feeAmount)
          : p.feeType === 'FIXO' && p.feeAmount
            ? p.feeAmount
            : 0;
      totalHoras += p.totalMinutes;
      totalBillable += p.billableMinutes;
      valorHoras += horasValue;
      totalDespesas += p.totalExpenses;
      porProcesso.push({
        processoId: pid,
        processoNumber: p.processoNumber,
        titulo: p.titulo,
        horas: Math.round((p.totalMinutes / 60) * 10) / 10,
        horasBillable: Math.round((p.billableMinutes / 60) * 10) / 10,
        valorHoras: horasValue,
        despesas: p.totalExpenses,
        receitaEstimada: horasValue,
      });
    }

    return {
      totalHoras: Math.round((totalHoras / 60) * 10) / 10,
      totalBillable: Math.round((totalBillable / 60) * 10) / 10,
      valorHoras,
      totalDespesas,
      receitaEstimada: valorHoras,
      custoTotal: totalDespesas,
      margemLucro:
        valorHoras > 0
          ? Math.round(((valorHoras - totalDespesas) / valorHoras) * 100)
          : 0,
      porProcesso,
    };
  }
}
