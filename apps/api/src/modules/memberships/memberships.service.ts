import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType, Role } from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Convite a user — se o user não existe, cria-o com password null
   * (terá de completar registo via fluxo separado de "accept invite").
   * Se já existe, cria a Membership pendente.
   */
  async invite(
    tenantId: string,
    actorUserId: string,
    dto: { email: string; role: Role },
  ) {
    const email = dto.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          firstName: email.split('@')[0],
          lastName: '',
        },
      });
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (existing) {
      throw new BadRequestException('User already has membership in tenant');
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        tenantId,
        role: dto.role,
        invitedBy: actorUserId,
        invitedAt: new Date(),
        // accept flow: leave acceptedAt null until user accepts
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.MEMBERSHIP,
      entityId: membership.id,
      afterData: { email, role: dto.role },
    });

    return membership;
  }

  async updateRole(
    membershipId: string,
    tenantId: string,
    actorUserId: string,
    newRole: Role,
  ) {
    const m = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!m || m.tenantId !== tenantId) {
      throw new NotFoundException('Membership not found');
    }
    const before = m;
    const after = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.ROLE_CHANGE,
      entityType: EntityType.MEMBERSHIP,
      entityId: membershipId,
      beforeData: before,
      afterData: after,
    });
    return after;
  }

  async remove(membershipId: string, tenantId: string, actorUserId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!m || m.tenantId !== tenantId) {
      throw new NotFoundException('Membership not found');
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.MEMBERSHIP,
      entityId: membershipId,
      beforeData: m,
    });
    return { ok: true };
  }

  async accept(userId: string, tenantId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!m) throw new NotFoundException('No pending invite');
    if (m.acceptedAt) return m;
    return this.prisma.membership.update({
      where: { id: m.id },
      data: { acceptedAt: new Date() },
    });
  }
}
