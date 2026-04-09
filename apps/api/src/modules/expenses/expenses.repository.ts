import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListExpensesParams {
  cursor?: string;
  limit: number;
  processoId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class ExpensesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListExpensesParams) {
    const {
      cursor,
      limit,
      processoId,
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

    const expenses = await this.prisma.expense.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        category: true,
        description: true,
        amount: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
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

    const hasMore = expenses.length > limit;
    const items = hasMore ? expenses.slice(0, limit) : expenses;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.expense.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.expense.findFirst({
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
    return this.prisma.expense.create({
      data,
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.expense.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.expense.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async getTotalByProcesso(gabineteId: string, processoId: string) {
    const result = await this.prisma.expense.aggregate({
      where: {
        gabineteId,
        processoId,
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || 0;
  }
}
