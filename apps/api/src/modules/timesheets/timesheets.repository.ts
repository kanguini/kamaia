import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListTimeEntriesParams {
  cursor?: string;
  limit: number;
  processoId?: string;
  userId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class TimesheetsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListTimeEntriesParams) {
    const {
      cursor,
      limit,
      processoId,
      userId,
      category,
      dateFrom,
      dateTo,
    } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (processoId) {
      where.processoId = processoId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (category) {
      where.category = category;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    }

    const entries = await this.prisma.timeEntry.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        category: true,
        description: true,
        date: true,
        durationMinutes: true,
        billable: true,
        createdAt: true,
        updatedAt: true,
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
            feeType: true,
            feeAmount: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.timeEntry.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.timeEntry.findFirst({
      where: {
        id,
        gabineteId,
        deletedAt: null,
      },
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
            feeType: true,
            feeAmount: true,
            advogadoId: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.timeEntry.create({
      data,
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.timeEntry.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.timeEntry.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async getSummary(gabineteId: string, dateFrom?: string, dateTo?: string) {
    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    }

    // Get all time entries in period
    const entries = await this.prisma.timeEntry.findMany({
      where,
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

    // Group manually by processoId
    const processoMap = new Map<string, any>();

    for (const entry of entries) {
      const pid = entry.processoId;
      if (!processoMap.has(pid)) {
        processoMap.set(pid, {
          processoId: pid,
          processoNumber: entry.processo.processoNumber,
          titulo: entry.processo.title,
          feeType: entry.processo.feeType,
          feeAmount: entry.processo.feeAmount,
          totalMinutes: 0,
          billableMinutes: 0,
        });
      }

      const p = processoMap.get(pid);
      p.totalMinutes += entry.durationMinutes;
      if (entry.billable) {
        p.billableMinutes += entry.durationMinutes;
      }
    }

    // Calculate values for each processo
    const porProcesso = [];
    for (const [pid, p] of processoMap) {
      let valor = 0;
      if (p.feeType === 'HORA' && p.feeAmount) {
        // Convert billable minutes to hours and multiply by hourly rate
        valor = Math.round((p.billableMinutes / 60) * p.feeAmount);
      } else if (p.feeType === 'FIXO' && p.feeAmount) {
        valor = p.feeAmount;
      }

      porProcesso.push({
        processoId: pid,
        processoNumber: p.processoNumber,
        titulo: p.titulo,
        totalMinutes: p.totalMinutes,
        billableMinutes: p.billableMinutes,
        valor,
      });
    }

    return porProcesso;
  }
}
