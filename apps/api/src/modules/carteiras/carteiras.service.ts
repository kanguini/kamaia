import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type CarteiraComCount = Prisma.CarteiraGetPayload<{
  include: { _count: { select: { contratos: true } } };
}>;

export interface CarteiraResponse {
  id: string;
  tenantId: string;
  nome: string;
  descricao: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  contratosCount: number;
}

@Injectable()
export class CarteirasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Forma uniforme de resposta — usada em list/get/create/update.
   * AUDIT fix: anteriormente `create`/`update` devolviam a row
   * Prisma raw (sem contratosCount) e `list`/`get` devolviam a
   * forma mapeada. Quem consumisse os 4 endpoints como o mesmo
   * tipo apanhava NaN ou metadata em falta. Agora todos passam
   * por aqui.
   */
  private shape(c: CarteiraComCount | (CarteiraComCount & { _count?: { contratos: number } })): CarteiraResponse {
    return {
      id: c.id,
      tenantId: c.tenantId,
      nome: c.nome,
      descricao: c.descricao,
      metadata: c.metadata,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      contratosCount: c._count?.contratos ?? 0,
    };
  }

  async list(tenantId: string): Promise<CarteiraResponse[]> {
    const rows = await this.prisma.carteira.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { contratos: { where: { deletedAt: null } } },
        },
      },
    });
    return rows.map((c) => this.shape(c));
  }

  async get(tenantId: string, id: string): Promise<CarteiraResponse> {
    const c = await this.prisma.carteira.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: { contratos: { where: { deletedAt: null } } },
        },
      },
    });
    if (!c) throw new NotFoundException('Carteira not found');
    return this.shape(c);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    dto: { nome: string; descricao?: string; metadata?: object },
  ): Promise<CarteiraResponse> {
    const c = await this.prisma.carteira.create({
      data: { tenantId, ...dto },
      include: { _count: { select: { contratos: true } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CARTEIRA,
      entityId: c.id,
      afterData: c as object,
    });
    return this.shape(c);
  }

  /**
   * AUDIT fix: o `update.where: { id }` original abria janela para
   * race com soft-delete intermédio — alguém apagasse a carteira
   * entre o `get` (assert tenant) e o `update`, e o `update` ainda
   * passava. Usamos `updateMany` com `where` composto (id + tenant
   * + deletedAt:null) para fechar a janela. count=0 → 404 explícito.
   */
  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: { nome?: string; descricao?: string; metadata?: object },
  ): Promise<CarteiraResponse> {
    const before = await this.get(tenantId, id);
    const r = await this.prisma.carteira.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: dto,
    });
    if (r.count === 0) throw new NotFoundException('Carteira not found (race)');
    const after = await this.prisma.carteira.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { contratos: { where: { deletedAt: null } } } } },
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
    return this.shape(after);
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
   * Move N contratos em batch entre carteiras (ou desliga todos
   * passando targetCarteiraId=null). Substitui o loop manual de
   * N PATCH.
   *
   * AUDIT fix: o caller original perdia visibilidade sobre que IDs
   * falharam — `r.count` podia ser < `contratoIds.length` mas o
   * cliente não sabia quais. Agora devolvemos `naoEncontrados`
   * explicitamente (IDs que não pertenciam ao tenant, foram
   * soft-deleted, ou não existiam).
   *
   * Tudo numa $transaction: se algum contrato perder o tenant
   * entre o updateMany e o second pass, o resultado é consistente.
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

    const { movidos, naoEncontrados, antes } = await this.prisma.$transaction(
      async (tx) => {
        // Pre-fetch contratos elegíveis (para distinguir movidos de
        // não-encontrados, e capturar before-state para audit).
        const elegiveis = await tx.contrato.findMany({
          where: {
            id: { in: contratoIds },
            tenantId,
            deletedAt: null,
          },
          select: { id: true, carteiraId: true },
        });
        const elegiveisIds = new Set(elegiveis.map((c) => c.id));
        const naoEncontrados = contratoIds.filter((id) => !elegiveisIds.has(id));

        if (elegiveisIds.size === 0) {
          return { movidos: 0, naoEncontrados, antes: [] as typeof elegiveis };
        }

        const r = await tx.contrato.updateMany({
          where: { id: { in: Array.from(elegiveisIds) } },
          data: { carteiraId: targetCarteiraId },
        });
        return { movidos: r.count, naoEncontrados, antes: elegiveis };
      },
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CARTEIRA,
      entityId: targetCarteiraId ?? 'unassigned',
      beforeData: {
        carteiraIds: antes.map((c) => ({ id: c.id, carteiraId: c.carteiraId })),
      },
      afterData: {
        movidos,
        naoEncontrados,
        contratoIds,
        targetCarteiraId,
      },
    });
    return { movidos, naoEncontrados };
  }
}
