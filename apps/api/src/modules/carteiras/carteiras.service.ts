import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CarteirasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.carteira.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { contratos: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.carteira.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { contratos: true } } },
    });
    if (!c) throw new NotFoundException('Carteira not found');
    return c;
  }

  async create(
    tenantId: string,
    actorUserId: string,
    dto: { nome: string; descricao?: string; metadata?: object },
  ) {
    const c = await this.prisma.carteira.create({
      data: { tenantId, ...dto },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CARTEIRA,
      entityId: c.id,
      afterData: c as object,
    });
    return c;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: { nome?: string; descricao?: string; metadata?: object },
  ) {
    const before = await this.get(tenantId, id);
    const after = await this.prisma.carteira.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CARTEIRA,
      entityId: id,
      beforeData: before as object,
      afterData: after as object,
    });
    return after;
  }

  async softDelete(tenantId: string, actorUserId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.carteira.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.CARTEIRA,
      entityId: id,
    });
    return { ok: true };
  }
}
