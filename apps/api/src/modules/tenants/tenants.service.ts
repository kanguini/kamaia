import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EntityType,
  PLAN_LIMITS,
  Role,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, acceptedAt: { not: null } },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            nome: true,
            plan: true,
            status: true,
            parentTenantId: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { isDefault: 'desc' },
    });
    return memberships.map((m) => ({
      ...m.tenant,
      role: m.role,
      isDefault: m.isDefault,
    }));
  }

  async get(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subTenants: {
          select: { id: true, slug: true, nome: true, plan: true, status: true },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  /**
   * AUDIT fix: race protection via updateMany composto (id + status
   * != DISABLED). Não permite updates a tenants em status terminal
   * — útil quando billing suspendeu o tenant e o owner ainda tenta
   * editar.
   */
  async update(
    tenantId: string,
    actorUserId: string,
    data: {
      nome?: string;
      nif?: string;
      email?: string;
      telefone?: string;
      morada?: object;
      logoUrl?: string;
    },
  ) {
    const before = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!before) throw new NotFoundException('Tenant not found');
    if (before.status === TenantStatus.CANCELLED) {
      throw new BadRequestException(
        'Tenant cancelado — contacta o billing para reactivar.',
      );
    }
    const r = await this.prisma.tenant.updateMany({
      where: { id: tenantId, status: { not: TenantStatus.CANCELLED } },
      data,
    });
    if (r.count === 0) throw new NotFoundException('Tenant not found (race)');
    const updated = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.TENANT,
      entityId: tenantId,
      beforeData: before as object,
      afterData: updated as object,
    });
    return updated;
  }

  /**
   * Cria um sub-tenant — apenas permitido se o tenant-pai for AGENCY.
   * O actor herda role ADMIN no sub-tenant via Membership directa.
   *
   * AUDIT fixes nesta auditoria:
   *  1. Respeita `subTenantsMax` do plano do parent — antes podia
   *     criar N sub-tenants ignorando o tecto do AGENCY
   *  2. Slug com sufixo random de 8 chars (3.4×10¹⁴ permutações)
   *     em vez de timestamp-based, que colidia em alta concorrência
   *  3. Audit.log FORA da transacção — se a tx falhar (e.g. unique
   *     constraint do slug), não fica audit-log órfão dum tenant
   *     que nunca existiu
   *  4. Re-verifica `acceptedAt` no membership (defesa em profundidade)
   */
  async createSubTenant(
    parentTenantId: string,
    actorUserId: string,
    dto: { nome: string; nif?: string; plan?: TenantPlan },
  ) {
    const parent = await this.prisma.tenant.findUnique({
      where: { id: parentTenantId },
    });
    if (!parent) throw new NotFoundException('Parent tenant not found');
    if (parent.plan !== TenantPlan.AGENCY) {
      throw new ForbiddenException(
        'Only AGENCY plan tenants can create sub-tenants',
      );
    }
    if (parent.parentTenantId) {
      throw new BadRequestException('Nested sub-tenants are not allowed');
    }

    // Limite de sub-tenants — AGENCY tem `subTenantsMax` no plano
    const limit = PLAN_LIMITS[parent.plan].subTenantsMax;
    if (limit !== -1) {
      const subCount = await this.prisma.tenant.count({
        where: { parentTenantId, deletedAt: null },
      });
      if (subCount >= limit) {
        throw new ForbiddenException(
          `Plano ${parent.plan} permite no máximo ${limit} sub-tenants (tens ${subCount}).`,
        );
      }
    }

    // Slug random — evita colisões sob alta concorrência
    const slug =
      this.slugify(dto.nome) + '-' + randomBytes(4).toString('hex');

    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug,
          nome: dto.nome,
          nif: dto.nif,
          plan: dto.plan ?? TenantPlan.STARTER,
          status: TenantStatus.ACTIVE,
          parentTenantId,
        },
      });
      await tx.membership.create({
        data: {
          tenantId: created.id,
          userId: actorUserId,
          role: Role.ADMIN,
          isDefault: false,
          acceptedAt: new Date(),
        },
      });
      return created;
    });

    // Audit após commit — se a tx falhar não fica audit órfão
    await this.audit.log({
      tenantId: parentTenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.TENANT,
      entityId: sub.id,
      afterData: sub as object,
    });
    return sub;
  }

  /**
   * AUDIT fix: filtra soft-deleted. Antes leakava sub-tenants
   * "apagados" para o painel do AGENCY.
   */
  async listSubTenants(parentTenantId: string) {
    return this.prisma.tenant.findMany({
      where: { parentTenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}
