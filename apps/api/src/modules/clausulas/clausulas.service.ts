import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClausulasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    q: { q?: string; categoria?: string; tags?: string[]; limit?: number; cursor?: string },
  ) {
    const limit = q.limit ?? 50;
    const where: Prisma.ClausulaWhereInput = {
      tenantId,
      ...(q.categoria && { categoria: q.categoria }),
      ...(q.tags && q.tags.length && { tags: { hasSome: q.tags } }),
      ...(q.q && {
        OR: [
          { titulo: { contains: q.q, mode: 'insensitive' } },
          { conteudo: { contains: q.q, mode: 'insensitive' } },
        ],
      }),
    };
    const rows = await this.prisma.clausula.findMany({
      where,
      take: limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: [{ usoCount: 'desc' }, { titulo: 'asc' }],
    });
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.clausula.findFirst({
      where: { id, tenantId },
    });
    if (!c) throw new NotFoundException('Clausula not found');
    return c;
  }

  async create(
    tenantId: string,
    dto: {
      categoria: string;
      titulo: string;
      conteudo: string;
      leiAplicavelArt?: string;
      tags?: string[];
      idioma?: string;
      origemContratoId?: string;
    },
  ) {
    return this.prisma.clausula.create({ data: { tenantId, ...dto } });
  }

  async incrementUso(id: string) {
    await this.prisma.clausula.update({
      where: { id },
      data: { usoCount: { increment: 1 } },
    });
  }
}
