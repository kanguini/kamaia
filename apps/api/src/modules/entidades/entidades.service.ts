import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEntidadeDto,
  ListEntidadesQuery,
  UpdateEntidadeDto,
} from './entidades.dto';

@Injectable()
export class EntidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, q: ListEntidadesQuery) {
    const where: Prisma.EntidadeWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.tipo && { tipo: q.tipo }),
      ...(q.nacionalidadeCambial && { nacionalidadeCambial: q.nacionalidadeCambial }),
      ...(q.sectorActividade && { sectorActividade: q.sectorActividade }),
      ...(q.q && {
        OR: [
          { nome: { contains: q.q, mode: 'insensitive' } },
          { nomeComercial: { contains: q.q, mode: 'insensitive' } },
          { nif: { contains: q.q } },
        ],
      }),
    };
    const rows = await this.prisma.entidade.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { nome: 'asc' },
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, id: string) {
    const e = await this.prisma.entidade.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        contactos: true,
        documentosKYC: true,
      },
    });
    if (!e) throw new NotFoundException('Entidade not found');
    return e;
  }

  async create(tenantId: string, actorUserId: string, dto: CreateEntidadeDto) {
    const e = await this.prisma.entidade.create({
      data: { tenantId, ...dto },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.ENTIDADE,
      entityId: e.id,
      afterData: e as object,
    });
    return e;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateEntidadeDto,
  ) {
    const before = await this.get(tenantId, id);
    const after = await this.prisma.entidade.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.ENTIDADE,
      entityId: id,
      beforeData: before as object,
      afterData: after as object,
    });
    return after;
  }

  async softDelete(tenantId: string, actorUserId: string, id: string) {
    await this.get(tenantId, id);  // confirms ownership
    await this.prisma.entidade.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.ENTIDADE,
      entityId: id,
    });
    return { ok: true };
  }
}
