import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListTramitacoesParams {
  cursor?: string;
  limit: number;
  processoId?: string;
  autor?: string;
  actoType?: string;
  dateFrom?: string;
  dateTo?: string;
}

const detailSelect = {
  id: true,
  gabineteId: true,
  processoId: true,
  autor: true,
  actoType: true,
  title: true,
  description: true,
  actoDate: true,
  generatedPrazoId: true,
  advancedToStage: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
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
  generatedPrazo: {
    select: {
      id: true,
      title: true,
      type: true,
      dueDate: true,
      status: true,
    },
  },
} as const;

@Injectable()
export class TramitacoesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListTramitacoesParams) {
    const { cursor, limit, processoId, autor, actoType, dateFrom, dateTo } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (processoId) where.processoId = processoId;
    if (autor) where.autor = autor;
    if (actoType) where.actoType = actoType;

    if (dateFrom || dateTo) {
      where.actoDate = {};
      if (dateFrom) where.actoDate.gte = new Date(dateFrom);
      if (dateTo) where.actoDate.lte = new Date(dateTo);
    }

    const tramitacoes = await this.prisma.tramitacao.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ actoDate: 'desc' }, { createdAt: 'desc' }],
      select: detailSelect,
    });

    const hasMore = tramitacoes.length > limit;
    const items = hasMore ? tramitacoes.slice(0, limit) : tramitacoes;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.tramitacao.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.tramitacao.findFirst({
      where: {
        id,
        gabineteId,
        deletedAt: null,
      },
      select: detailSelect,
    });
  }

  async create(data: any) {
    return this.prisma.tramitacao.create({
      data,
      select: detailSelect,
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.tramitacao.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.tramitacao.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async linkGeneratedPrazo(id: string, prazoId: string) {
    return this.prisma.tramitacao.update({
      where: { id },
      data: { generatedPrazoId: prazoId },
    });
  }
}
