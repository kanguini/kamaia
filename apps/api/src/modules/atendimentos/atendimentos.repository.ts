import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListAtendimentosParams {
  cursor?: string;
  limit: number;
  status?: string;
  source?: string;
  assignedToId?: string;
  search?: string;
  /** When provided, restricts results to atendimentos assigned to this user.
   *  Used for ADVOGADO_MEMBRO which should not see the whole firm pipeline. */
  restrictToAssignee?: string;
}

const LIST_SELECT = {
  id: true,
  name: true,
  type: true,
  nif: true,
  email: true,
  phone: true,
  subject: true,
  description: true,
  source: true,
  status: true,
  priority: true,
  notes: true,
  lostReason: true,
  convertedClienteId: true,
  convertedProcessoId: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: {
    select: { id: true, firstName: true, lastName: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  convertedCliente: {
    select: { id: true, name: true },
  },
  convertedProcesso: {
    select: { id: true, processoNumber: true, title: true },
  },
} as const;

@Injectable()
export class AtendimentosRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(gabineteId: string, params: ListAtendimentosParams) {
    const { cursor, limit, status, source, assignedToId, search, restrictToAssignee } =
      params;

    const where: any = { gabineteId, deletedAt: null };
    if (status) where.status = status;
    if (source) where.source = source;
    if (assignedToId) where.assignedToId = assignedToId;
    if (restrictToAssignee) where.assignedToId = restrictToAssignee;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { nif: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.atendimento.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      select: LIST_SELECT,
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    const total = await this.prisma.atendimento.count({ where });

    return { data, nextCursor, total };
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.atendimento.findFirst({
      where: { id, gabineteId, deletedAt: null },
      select: LIST_SELECT,
    });
  }

  async create(gabineteId: string, createdById: string, data: any) {
    return this.prisma.atendimento.create({
      data: {
        ...data,
        gabineteId,
        createdById,
      },
      select: LIST_SELECT,
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.atendimento.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.atendimento.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async statsByStatus(gabineteId: string, restrictToAssignee?: string) {
    const where: any = { gabineteId, deletedAt: null };
    if (restrictToAssignee) where.assignedToId = restrictToAssignee;

    const groups = await this.prisma.atendimento.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const map: Record<string, number> = {
      NOVO: 0,
      EM_ANALISE: 0,
      QUALIFICADO: 0,
      CONVERTIDO: 0,
      PERDIDO: 0,
    };
    for (const g of groups) map[g.status] = g._count.id;
    return map;
  }
}
