import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS, LIFECYCLE_STAGES } from '@kamaia/shared-types';

export interface DashboardStats {
  activeProcessos: number;
  upcomingPrazos: number;
  activeClientes: number;
  aiQueriesRemaining: number;
}

export interface KPIData {
  processosByType: Record<string, number>;
  processosByLifecycle: Record<string, number>;
  prazosByStatus: { pendente: number; cumprido: number; expirado: number };
  revenueByMonth: Array<{ month: string; value: number }>;
  topProcessos: Array<{ id: string; title: string; horas: number; valor: number }>;
  overduePrazos: number;
  totalDocuments: number;
  totalTimeHours: number;
}

export interface TaskscoreResult {
  userId: string;
  userName: string;
  score: number;
  breakdown: {
    processosCriados: number;
    fasesAvancadas: number;
    prazosCumpridos: number;
    horasRegistadas: number;
    documentosEnviados: number;
    notasAdicionadas: number;
  };
}

// Point values for taskscore calculation
const TASKSCORE_POINTS = {
  PROCESSO_CRIADO: 50,
  FASE_AVANCADA: 30,
  PRAZO_CUMPRIDO_TEMPO: 40,
  PRAZO_CUMPRIDO_ATRASADO: 20,
  HORA_REGISTADA: 10, // per hour
  DOCUMENTO_ENVIADO: 15,
  NOTA_ADICIONADA: 5,
};

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(gabineteId: string): Promise<DashboardStats> {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const [activeProcessos, upcomingPrazos, activeClientes, gabinete] =
      await Promise.all([
        this.prisma.processo.count({
          where: { gabineteId, status: 'ACTIVO', deletedAt: null },
        }),
        this.prisma.prazo.count({
          where: {
            gabineteId,
            status: 'PENDENTE',
            dueDate: { gte: now, lte: threeDaysFromNow },
            deletedAt: null,
          },
        }),
        this.prisma.cliente.count({
          where: { gabineteId, isActive: true, deletedAt: null },
        }),
        this.prisma.gabinete.findUnique({
          where: { id: gabineteId },
          select: {
            plan: true,
            usageQuota: { select: { aiQueriesUsed: true } },
          },
        }),
      ]);

    let aiQueriesRemaining = 0;
    if (gabinete) {
      const planLimit =
        PLAN_LIMITS[gabinete.plan as keyof typeof PLAN_LIMITS].aiQueries;
      const used = gabinete.usageQuota?.aiQueriesUsed || 0;
      aiQueriesRemaining = planLimit === -1 ? -1 : Math.max(0, planLimit - used);
    }

    return { activeProcessos, upcomingPrazos, activeClientes, aiQueriesRemaining };
  }

  async getKPIs(gabineteId: string): Promise<KPIData> {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // All parallel queries
    const [
      processosByTypeRaw,
      processosByLifecycleRaw,
      pendentePrazos,
      cumpridoPrazos,
      expiradoPrazos,
      overduePrazos,
      totalDocuments,
      timeEntries,
      topProcessosRaw,
    ] = await Promise.all([
      // Processos by type
      this.prisma.processo.groupBy({
        by: ['type'],
        where: { gabineteId, deletedAt: null },
        _count: { id: true },
      }),
      // Processos by lifecycle
      this.prisma.processo.groupBy({
        by: ['lifecycle'],
        where: { gabineteId, deletedAt: null },
        _count: { id: true },
      }),
      // Prazos by status
      this.prisma.prazo.count({
        where: { gabineteId, status: 'PENDENTE', deletedAt: null },
      }),
      this.prisma.prazo.count({
        where: { gabineteId, status: 'CUMPRIDO', deletedAt: null },
      }),
      this.prisma.prazo.count({
        where: { gabineteId, status: 'EXPIRADO', deletedAt: null },
      }),
      // Overdue prazos
      this.prisma.prazo.count({
        where: {
          gabineteId,
          status: 'PENDENTE',
          dueDate: { lt: now },
          deletedAt: null,
        },
      }),
      // Documents
      this.prisma.document.count({
        where: { gabineteId, deletedAt: null },
      }),
      // Time entries for revenue calculation
      this.prisma.timeEntry.findMany({
        where: {
          gabineteId,
          deletedAt: null,
          date: { gte: sixMonthsAgo },
        },
        select: {
          date: true,
          durationMinutes: true,
          billable: true,
          hourlyRate: true,
          processo: {
            select: { feeType: true, feeAmount: true },
          },
        },
      }),
      // Top processos by hours
      this.prisma.timeEntry.groupBy({
        by: ['processoId'],
        where: { gabineteId, deletedAt: null, billable: true },
        _sum: { durationMinutes: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
        take: 5,
      }),
    ]);

    // Process processos by type
    const processosByType: Record<string, number> = {};
    for (const g of processosByTypeRaw) {
      processosByType[g.type] = g._count.id;
    }

    // Process processos by lifecycle
    const processosByLifecycle: Record<string, number> = {};
    for (const stage of LIFECYCLE_STAGES) {
      processosByLifecycle[stage] = 0;
    }
    for (const g of processosByLifecycleRaw) {
      processosByLifecycle[g.lifecycle] = g._count.id;
    }

    // Revenue by month (last 6 months)
    const revenueByMonth: Array<{ month: string; value: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      const monthEntries = timeEntries.filter((e) => {
        const d = new Date(e.date);
        return (
          d.getFullYear() === monthDate.getFullYear() &&
          d.getMonth() === monthDate.getMonth()
        );
      });

      let monthValue = 0;
      for (const entry of monthEntries) {
        if (entry.billable) {
          const rate = entry.hourlyRate || entry.processo.feeAmount || 0;
          if (entry.processo.feeType === 'HORA') {
            monthValue += Math.round((entry.durationMinutes / 60) * rate);
          }
        }
      }

      revenueByMonth.push({ month: monthKey, value: monthValue });
    }

    // Total time hours
    const totalTimeHours = timeEntries.reduce(
      (sum, e) => sum + e.durationMinutes,
      0,
    ) / 60;

    // Top processos (enrich with titles)
    const topProcessos: Array<{ id: string; title: string; horas: number; valor: number }> = [];
    if (topProcessosRaw.length > 0) {
      const processoIds = topProcessosRaw.map((p) => p.processoId);
      const processos = await this.prisma.processo.findMany({
        where: { id: { in: processoIds } },
        select: { id: true, title: true, feeType: true, feeAmount: true },
      });
      const processoMap = new Map(processos.map((p) => [p.id, p]));

      for (const raw of topProcessosRaw) {
        const p = processoMap.get(raw.processoId);
        const mins = raw._sum.durationMinutes || 0;
        const horas = Math.round((mins / 60) * 10) / 10;
        const valor =
          p?.feeType === 'HORA' && p.feeAmount
            ? Math.round((mins / 60) * p.feeAmount)
            : p?.feeType === 'FIXO' && p?.feeAmount
              ? p.feeAmount
              : 0;

        topProcessos.push({
          id: raw.processoId,
          title: p?.title || 'N/A',
          horas,
          valor,
        });
      }
    }

    return {
      processosByType,
      processosByLifecycle,
      prazosByStatus: {
        pendente: pendentePrazos,
        cumprido: cumpridoPrazos,
        expirado: expiradoPrazos,
      },
      revenueByMonth,
      topProcessos,
      overduePrazos,
      totalDocuments,
      totalTimeHours: Math.round(totalTimeHours * 10) / 10,
    };
  }

  async getTaskscore(
    gabineteId: string,
    period: 'week' | 'month' = 'month',
  ): Promise<TaskscoreResult[]> {
    const now = new Date();
    const since = new Date(now);
    if (period === 'week') {
      since.setDate(since.getDate() - 7);
    } else {
      since.setMonth(since.getMonth() - 1);
    }

    // Get all users of this gabinete
    const users = await this.prisma.user.findMany({
      where: { gabineteId, deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    const results: TaskscoreResult[] = [];

    for (const user of users) {
      // Count actions in period
      const [
        processosCriados,
        stageChanges,
        prazosCumpridos,
        timeEntries,
        docsUploaded,
        notesAdded,
      ] = await Promise.all([
        // Processos created
        this.prisma.auditLog.count({
          where: {
            gabineteId,
            userId: user.id,
            action: 'CREATE',
            entity: 'PROCESSO',
            createdAt: { gte: since },
          },
        }),
        // Stage/lifecycle changes
        this.prisma.processoEvent.count({
          where: {
            userId: user.id,
            type: 'STAGE_CHANGE',
            createdAt: { gte: since },
            processo: { gabineteId },
          },
        }),
        // Prazos completed
        this.prisma.prazo.count({
          where: {
            gabineteId,
            status: 'CUMPRIDO',
            completedAt: { gte: since },
          },
        }),
        // Time entries (sum minutes)
        this.prisma.timeEntry.aggregate({
          where: {
            gabineteId,
            userId: user.id,
            deletedAt: null,
            date: { gte: since },
          },
          _sum: { durationMinutes: true },
        }),
        // Documents uploaded
        this.prisma.document.count({
          where: {
            gabineteId,
            uploadedById: user.id,
            deletedAt: null,
            createdAt: { gte: since },
          },
        }),
        // Notes added (ProcessoEvent type NOTE)
        this.prisma.processoEvent.count({
          where: {
            userId: user.id,
            type: 'NOTE',
            createdAt: { gte: since },
            processo: { gabineteId },
          },
        }),
      ]);

      const horasRegistadas = (timeEntries._sum.durationMinutes || 0) / 60;

      const score =
        processosCriados * TASKSCORE_POINTS.PROCESSO_CRIADO +
        stageChanges * TASKSCORE_POINTS.FASE_AVANCADA +
        prazosCumpridos * TASKSCORE_POINTS.PRAZO_CUMPRIDO_TEMPO +
        Math.round(horasRegistadas) * TASKSCORE_POINTS.HORA_REGISTADA +
        docsUploaded * TASKSCORE_POINTS.DOCUMENTO_ENVIADO +
        notesAdded * TASKSCORE_POINTS.NOTA_ADICIONADA;

      results.push({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        score,
        breakdown: {
          processosCriados,
          fasesAvancadas: stageChanges,
          prazosCumpridos,
          horasRegistadas: Math.round(horasRegistadas * 10) / 10,
          documentosEnviados: docsUploaded,
          notasAdicionadas: notesAdded,
        },
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  async getRentabilidade(gabineteId: string, processoId?: string) {
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

    const expenses = await this.prisma.expense.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        ...(processoId ? { processoId } : {}),
      },
    });

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

  /**
   * Single-call aggregator for the executive dashboard. Pulls financial,
   * operational and risk signals in one round-trip so the homepage renders
   * without waterfalls.
   */
  async getExecutiveDashboard(
    gabineteId: string,
    userId: string,
  ): Promise<any> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const [
      // Financial
      invoicesThisMonth,
      outstandingInvoices,
      totalBillableMinutesThisMonth,
      totalLoggedMinutesThisMonth,
      unbilledBillable,
      // Operational
      activeProjects,
      atRiskProjects,
      upcomingPrazos,
      criticalPrazos,
      overduePrazos,
      unreadNotifications,
      recentUnread,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          gabineteId,
          deletedAt: null,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID'] },
          issueDate: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { total: true, amountPaid: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          gabineteId,
          deletedAt: null,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { total: true, amountPaid: true },
        _count: true,
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          gabineteId,
          billable: true,
          deletedAt: null,
          date: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          gabineteId,
          deletedAt: null,
          date: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          gabineteId,
          billable: true,
          invoiceId: null,
          deletedAt: null,
        },
        select: {
          durationMinutes: true,
          hourlyRate: true,
          processo: {
            select: {
              feeAmount: true,
              cliente: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.project.count({
        where: { gabineteId, deletedAt: null, status: 'ACTIVO' },
      }),
      this.prisma.project.findMany({
        where: {
          gabineteId,
          deletedAt: null,
          status: 'ACTIVO',
          healthStatus: { in: ['YELLOW', 'RED'] },
        },
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          healthStatus: true,
          endDate: true,
          _count: { select: { milestones: true } },
        },
        orderBy: { healthStatus: 'desc' },
        take: 5,
      }),
      this.prisma.prazo.count({
        where: {
          gabineteId,
          deletedAt: null,
          status: 'PENDENTE',
          dueDate: { gte: weekStart, lt: weekEnd },
        },
      }),
      this.prisma.prazo.findMany({
        where: {
          gabineteId,
          deletedAt: null,
          status: 'PENDENTE',
          OR: [
            { isUrgent: true },
            { dueDate: { lt: new Date(now.getTime() + 3 * 86_400_000) } },
          ],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          isUrgent: true,
          type: true,
          processo: { select: { id: true, processoNumber: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      this.prisma.prazo.count({
        where: {
          gabineteId,
          deletedAt: null,
          status: 'PENDENTE',
          dueDate: { lt: now },
        },
      }),
      this.prisma.notification.count({
        where: { gabineteId, userId, readAt: null },
      }),
      this.prisma.notification.findMany({
        where: { gabineteId, userId, readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          type: true,
          subject: true,
          body: true,
          createdAt: true,
          metadata: true,
        },
      }),
    ]);

    // Compute WIP value by cliente
    const wipByClienteMap = new Map<
      string,
      { clienteId: string; clienteName: string; hours: number; value: number }
    >();
    for (const t of unbilledBillable) {
      const clienteId = t.processo.cliente.id;
      const clienteName = t.processo.cliente.name;
      const rate = t.hourlyRate ?? t.processo.feeAmount ?? 0;
      const value = Math.round((t.durationMinutes / 60) * rate);
      const row = wipByClienteMap.get(clienteId) ?? {
        clienteId,
        clienteName,
        hours: 0,
        value: 0,
      };
      row.hours += t.durationMinutes / 60;
      row.value += value;
      wipByClienteMap.set(clienteId, row);
    }
    const topWipClientes = [...wipByClienteMap.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const revenueBilledThisMonth =
      invoicesThisMonth._sum.total ?? 0;
    const revenuePaidThisMonth =
      invoicesThisMonth._sum.amountPaid ?? 0;
    const outstandingTotal =
      (outstandingInvoices._sum.total ?? 0) -
      (outstandingInvoices._sum.amountPaid ?? 0);

    const billableHoursThisMonth =
      (totalBillableMinutesThisMonth._sum.durationMinutes ?? 0) / 60;
    const loggedHoursThisMonth =
      (totalLoggedMinutesThisMonth._sum.durationMinutes ?? 0) / 60;
    const billableRatio =
      loggedHoursThisMonth > 0
        ? billableHoursThisMonth / loggedHoursThisMonth
        : 0;

    return {
      financial: {
        revenueBilledThisMonth,
        revenuePaidThisMonth,
        outstandingTotal,
        outstandingInvoices: outstandingInvoices._count,
        wipValue: topWipClientes.reduce((s, r) => s + r.value, 0),
        currency: 'AKZ',
      },
      operational: {
        billableHoursThisMonth: Math.round(billableHoursThisMonth * 10) / 10,
        loggedHoursThisMonth: Math.round(loggedHoursThisMonth * 10) / 10,
        billableRatio: Math.round(billableRatio * 100) / 100,
        activeProjects,
        upcomingPrazos,
      },
      risk: {
        atRiskProjects,
        criticalPrazos,
        overduePrazos,
        unreadAlerts: unreadNotifications,
        recentAlerts: recentUnread,
      },
      topWipClientes,
    };
  }
}
