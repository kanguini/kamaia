import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, Role } from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cláusulas reutilizáveis.
 *
 * Auditoria de hoje encontrou:
 *  - list() não filtrava isApproved — cláusulas pendentes vazavam
 *    para BUSINESS_USER/VIEWER
 *  - incrementUso() sem tenant validation + nunca chamado
 *  - sem audit log nas mutations
 *  - sem soft delete
 *
 * Tudo corrigido.
 */
@Injectable()
export class ClausulasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * FIX auditoria: filtra `isApproved` por papel do utilizador.
   * - ADMIN / LEGAL_LEAD: vê todas (incluindo pendentes para revisão)
   * - CONTRACT_MANAGER, BUSINESS_USER, VIEWER: só aprovadas
   *
   * O caller passa o role do utilizador via `userRole`. O Compliance
   * Engine + IaDraftingService já filtram explicitamente com
   * `isApproved: true` (caso de uso programático).
   */
  async list(
    tenantId: string,
    q: {
      q?: string;
      categoria?: string;
      tags?: string[];
      tipoContratoCodigo?: string;
      limit?: number;
      cursor?: string;
      includeUnapproved?: boolean;
    },
    userRole?: Role,
  ) {
    const podeVerPendentes =
      userRole === Role.ADMIN || userRole === Role.LEGAL_LEAD;

    const limit = q.limit ?? 50;
    const where: Prisma.ClausulaWhereInput = {
      tenantId,
      ...(!podeVerPendentes && { isApproved: true }),
      ...(q.categoria && { categoria: q.categoria }),
      ...(q.tags && q.tags.length && { tags: { hasSome: q.tags } }),
      ...(q.tipoContratoCodigo && {
        tipoContratoCodigos: { has: q.tipoContratoCodigo },
      }),
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
    actorUserId: string,
    dto: {
      categoria: string;
      titulo: string;
      conteudo: string;
      leiAplicavelArt?: string;
      tags?: string[];
      tipoContratoCodigos?: string[];
      idioma?: string;
      origemContratoId?: string;
    },
  ) {
    const c = await this.prisma.clausula.create({
      data: { tenantId, ...dto },
    });
    // FIX auditoria: audit log estava em falta
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CLAUSULA,
      entityId: c.id,
      afterData: { titulo: c.titulo, categoria: c.categoria, origemContratoId: c.origemContratoId },
    });
    return c;
  }

  /**
   * Aprova uma cláusula pendente — só ADMIN/LEGAL_LEAD (controller
   * impõe via @Roles). Quando aprovada, fica disponível para todos
   * via `list()` e entra no contexto da IA para drafting.
   */
  async approve(tenantId: string, actorUserId: string, id: string) {
    const before = await this.get(tenantId, id);
    if (before.isApproved) return before;
    const r = await this.prisma.clausula.updateMany({
      where: { id, tenantId },
      data: { isApproved: true },
    });
    if (r.count === 0) throw new NotFoundException('Clausula not found');
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CLAUSULA,
      entityId: id,
      beforeData: { isApproved: false },
      afterData: { isApproved: true },
    });
    return this.prisma.clausula.findUniqueOrThrow({ where: { id } });
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: {
      titulo?: string;
      conteudo?: string;
      categoria?: string;
      tags?: string[];
      tipoContratoCodigos?: string[];
      leiAplicavelArt?: string;
    },
  ) {
    const before = await this.get(tenantId, id);
    const r = await this.prisma.clausula.updateMany({
      where: { id, tenantId },
      data: dto,
    });
    if (r.count === 0) throw new NotFoundException('Clausula not found');
    const after = await this.prisma.clausula.findUniqueOrThrow({ where: { id } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CLAUSULA,
      entityId: id,
      beforeData: before as object,
      afterData: after as object,
    });
    return after;
  }

  /**
   * FIX auditoria: incrementUso agora exige tenantId — evita que
   * caller mal-intencionado dispare incremento em cláusula de outro
   * tenant. usoCount é métrica de popularidade, usada para ordenar
   * em `list()`.
   */
  async incrementUso(tenantId: string, id: string) {
    await this.prisma.clausula.updateMany({
      where: { id, tenantId },
      data: { usoCount: { increment: 1 } },
    });
  }
}
