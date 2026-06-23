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
    // FIX auditoria: frontend espera campo `contratosCount` flat; antes
    // devolvíamos `_count: { contratos }` e ficava NaN no UI.
    const rows = await this.prisma.carteira.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { contratos: { where: { deletedAt: null } } },
        },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      nome: c.nome,
      descricao: c.descricao,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      contratosCount: c._count.contratos,
    }));
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.carteira.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: { contratos: { where: { deletedAt: null } } },
        },
      },
    });
    if (!c) throw new NotFoundException('Carteira not found');
    return {
      id: c.id,
      tenantId: c.tenantId,
      nome: c.nome,
      descricao: c.descricao,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      contratosCount: c._count.contratos,
    };
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

  /**
   * FIX auditoria: ao soft-delete a carteira, os contratos que apontam
   * para ela ficam com carteiraId órfã. Resolvemos numa transaction:
   * desliga os contratos (carteiraId=null) antes de soft-delete.
   * Audit captura quantos contratos ficaram "soltos".
   */
  async softDelete(tenantId: string, actorUserId: string, id: string) {
    await this.get(tenantId, id);
    const desligados = await this.prisma.$transaction(async (tx) => {
      const r = await tx.contrato.updateMany({
        where: { carteiraId: id, tenantId, deletedAt: null },
        data: { carteiraId: null },
      });
      await tx.carteira.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return r.count;
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.CARTEIRA,
      entityId: id,
      afterData: { contratosDesligados: desligados },
    });
    return { ok: true, contratosDesligados: desligados };
  }

  /**
   * FIX auditoria: novo endpoint para mover contratos em batch entre
   * carteiras. Substitui o loop de N PATCH /contratos/:id que o user
   * teria de fazer manualmente.
   */
  async moverContratos(
    tenantId: string,
    actorUserId: string,
    targetCarteiraId: string | null,
    contratoIds: string[],
  ) {
    // Valida target existe e é do tenant (null = "remover de carteira")
    if (targetCarteiraId) {
      await this.get(tenantId, targetCarteiraId);
    }
    const r = await this.prisma.contrato.updateMany({
      where: {
        id: { in: contratoIds },
        tenantId,
        deletedAt: null,
      },
      data: { carteiraId: targetCarteiraId },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CARTEIRA,
      entityId: targetCarteiraId ?? 'unassigned',
      afterData: {
        movidos: r.count,
        contratoIds,
        targetCarteiraId,
      },
    });
    return { movidos: r.count };
  }
}
