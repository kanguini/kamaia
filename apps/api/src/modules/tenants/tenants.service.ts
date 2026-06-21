import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EntityType,
  Role,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
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
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
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

    const slug =
      this.slugify(dto.nome) + '-' + Date.now().toString(36).slice(-6);

    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.tenant.create({
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
          tenantId: sub.id,
          userId: actorUserId,
          role: Role.ADMIN,
          isDefault: false,
          acceptedAt: new Date(),
        },
      });
      await this.audit.log({
        tenantId: parentTenantId,
        actorUserId,
        action: AuditAction.CREATE,
        entityType: EntityType.TENANT,
        entityId: sub.id,
        afterData: sub as object,
      });
      return sub;
    });
  }

  async listSubTenants(parentTenantId: string) {
    return this.prisma.tenant.findMany({
      where: { parentTenantId },
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
