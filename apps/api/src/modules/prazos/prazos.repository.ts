import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListPrazosParams {
  cursor?: string;
  limit: number;
  status?: string;
  processoId?: string;
  type?: string;
  isUrgent?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

@Injectable()
export class PrazosRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListPrazosParams) {
    const {
      cursor,
      limit,
      status,
      processoId,
      type,
      isUrgent,
      dateFrom,
      dateTo,
      search,
    } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (processoId) {
      where.processoId = processoId;
    }

    if (type) {
      where.type = type;
    }

    if (isUrgent !== undefined) {
      where.isUrgent = isUrgent;
    }

    if (dateFrom || dateTo) {
      where.dueDate = {};
      if (dateFrom) {
        where.dueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.dueDate.lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const prazos = await this.prisma.prazo.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        dueDate: true,
        isUrgent: true,
        alertHoursBefore: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
      },
    });

    const hasMore = prazos.length > limit;
    const items = hasMore ? prazos.slice(0, limit) : prazos;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.prazo.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findUpcoming(gabineteId: string, days: number = 7) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Get upcoming prazos (next 7 days, PENDENTE)
    const upcoming = await this.prisma.prazo.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        status: 'PENDENTE',
        dueDate: {
          gte: now,
          lte: futureDate,
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
      },
    });

    // Get overdue prazos (past, still PENDENTE)
    const overdue = await this.prisma.prazo.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        status: 'PENDENTE',
        dueDate: {
          lt: now,
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
      },
    });

    return {
      upcoming,
      overdue,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.prazo.findFirst({
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
            advogadoId: true,
            type: true,
          },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.prazo.create({
      data,
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.prazo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.prazo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async changeStatus(
    gabineteId: string,
    id: string,
    status: string,
    completedAt?: Date,
  ) {
    await this.prisma.prazo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: {
        status,
        ...(completedAt && { completedAt }),
      },
    });
    return this.findById(gabineteId, id);
  }

  async countByStatus(gabineteId: string) {
    const results = await this.prisma.prazo.groupBy({
      by: ['status'],
      where: {
        gabineteId,
        deletedAt: null,
      },
      _count: true,
    });

    return results.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async findByProcesso(
    gabineteId: string,
    processoId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    const where = {
      gabineteId,
      processoId,
      deletedAt: null,
    };

    const prazos = await this.prisma.prazo.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { dueDate: 'asc' },
    });

    const hasMore = prazos.length > limit;
    const items = hasMore ? prazos.slice(0, limit) : prazos;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.prazo.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }
}
