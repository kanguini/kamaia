import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListProcessosParams {
  cursor?: string;
  limit: number;
  status?: string;
  type?: string;
  advogadoId?: string;
  clienteId?: string;
  priority?: string;
  search?: string;
}

@Injectable()
export class ProcessosRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListProcessosParams) {
    const { cursor, limit, status, type, advogadoId, clienteId, priority, search } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (advogadoId) {
      where.advogadoId = advogadoId;
    }

    if (clienteId) {
      where.clienteId = clienteId;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { processoNumber: { contains: search, mode: 'insensitive' } },
        { opposingParty: { contains: search, mode: 'insensitive' } },
      ];
    }

    const processos = await this.prisma.processo.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        processoNumber: true,
        title: true,
        type: true,
        status: true,
        stage: true,
        priority: true,
        openedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        cliente: {
          select: {
            id: true,
            name: true,
          },
        },
        advogado: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const hasMore = processos.length > limit;
    const items = hasMore ? processos.slice(0, limit) : processos;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.processo.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.processo.findFirst({
      where: {
        id,
        gabineteId,
        deletedAt: null,
      },
      include: {
        cliente: {
          select: {
            id: true,
            name: true,
          },
        },
        advogado: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        prazos: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async create(gabineteId: string, data: any) {
    return this.prisma.processo.create({
      data: {
        ...data,
        gabineteId,
      },
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.processo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.processo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async changeStage(gabineteId: string, id: string, stage: string) {
    await this.prisma.processo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { stage },
    });
    return this.findById(gabineteId, id);
  }

  async changeStatus(gabineteId: string, id: string, status: string, closedAt?: Date) {
    await this.prisma.processo.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: {
        status,
        ...(closedAt && { closedAt }),
      },
    });
    return this.findById(gabineteId, id);
  }

  async countByGabinete(gabineteId: string) {
    return this.prisma.processo.count({
      where: {
        gabineteId,
        deletedAt: null,
        status: 'ACTIVO',
      },
    });
  }

  async getNextNumber(gabineteId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `PROC-${currentYear}-`;

    const lastProcesso = await this.prisma.processo.findFirst({
      where: {
        gabineteId,
        processoNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        processoNumber: 'desc',
      },
      select: {
        processoNumber: true,
      },
    });

    if (!lastProcesso) {
      return `${prefix}0001`;
    }

    const lastNumber = parseInt(lastProcesso.processoNumber.split('-')[2], 10);
    const nextNumber = lastNumber + 1;

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  async createEvent(processoId: string, userId: string, data: any) {
    return this.prisma.processoEvent.create({
      data: {
        processoId,
        userId,
        ...data,
      },
    });
  }

  async findEvents(processoId: string, cursor?: string, limit: number = 20) {
    const events = await this.prisma.processoEvent.findMany({
      where: {
        processoId,
        deletedAt: null,
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const hasMore = events.length > limit;
    const items = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.processoEvent.count({
      where: { processoId, deletedAt: null },
    });

    return {
      data: items,
      nextCursor,
      total,
    };
  }
}
