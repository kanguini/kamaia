import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListClientesParams {
  cursor?: string;
  limit: number;
  type?: 'INDIVIDUAL' | 'EMPRESA';
  search?: string;
}

@Injectable()
export class ClientesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListClientesParams) {
    const { cursor, limit, type, search } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nif: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clientes = await this.prisma.cliente.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        nif: true,
        email: true,
        phone: true,
        address: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { processos: true },
        },
      },
    });

    const hasMore = clientes.length > limit;
    const items = hasMore ? clientes.slice(0, limit) : clientes;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.cliente.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.cliente.findFirst({
      where: {
        id,
        gabineteId,
        deletedAt: null,
      },
      include: {
        processos: {
          where: { deletedAt: null },
          select: {
            id: true,
            processoNumber: true,
            title: true,
            status: true,
            type: true,
            openedAt: true,
          },
          orderBy: { openedAt: 'desc' },
        },
      },
    });
  }

  async create(gabineteId: string, advogadoId: string, data: any) {
    return this.prisma.cliente.create({
      data: {
        ...data,
        gabineteId,
        advogadoId,
      },
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    return this.prisma.cliente.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    }).then(() => this.findById(gabineteId, id));
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.cliente.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async countByGabinete(gabineteId: string) {
    return this.prisma.cliente.count({
      where: {
        gabineteId,
        deletedAt: null,
        isActive: true,
      },
    });
  }

  async existsByNif(gabineteId: string, nif: string, excludeId?: string) {
    const where: any = {
      gabineteId,
      nif,
      deletedAt: null,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.cliente.count({ where });
    return count > 0;
  }
}
