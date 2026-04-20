import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListAudienciasParams {
  cursor?: string;
  limit: number;
  processoId?: string;
  status?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
}

const detailSelect = {
  id: true,
  gabineteId: true,
  processoId: true,
  type: true,
  status: true,
  scheduledAt: true,
  heldAt: true,
  durationMinutes: true,
  location: true,
  judge: true,
  notes: true,
  outcome: true,
  previousId: true,
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
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

@Injectable()
export class AudienciasRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListAudienciasParams) {
    const { cursor, limit, processoId, status, type, fromDate, toDate } = params;

    const where: any = {
      gabineteId,
      deletedAt: null,
    };
    if (processoId) where.processoId = processoId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (fromDate || toDate) {
      where.scheduledAt = {};
      if (fromDate) where.scheduledAt.gte = new Date(fromDate);
      if (toDate) where.scheduledAt.lte = new Date(toDate);
    }

    const audiencias = await this.prisma.audiencia.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ scheduledAt: 'asc' }],
      select: detailSelect,
    });

    const hasMore = audiencias.length > limit;
    const items = hasMore ? audiencias.slice(0, limit) : audiencias;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    const total = await this.prisma.audiencia.count({ where });

    return { data: items, nextCursor, total };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.audiencia.findFirst({
      where: { id, gabineteId, deletedAt: null },
      select: detailSelect,
    });
  }

  async findUpcoming(gabineteId: string, days = 30) {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + days);

    return this.prisma.audiencia.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        status: 'AGENDADA',
        scheduledAt: { gte: now, lte: until },
      },
      orderBy: [{ scheduledAt: 'asc' }],
      take: 50,
      select: detailSelect,
    });
  }

  async create(data: any) {
    return this.prisma.audiencia.create({ data, select: detailSelect });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.audiencia.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.audiencia.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
