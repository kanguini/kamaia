import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, EntityType, Role } from '@kamaia/shared-types';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async list(tenantId: string) {
    // AUDIT fix: filtra soft-deleted
    return this.prisma.membership.findMany({
      where: { tenantId, deletedAt: null },
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
   * AUDIT fix: convite com magic-link.
   *
   * Antes: o user tinha de saber descobrir que tinha um Membership
   * pendente — não havia notificação. Agora:
   *  1. Gera token raw (prefix-secret), persiste só hash + TTL 7 dias
   *  2. Envia email com URL contendo o token
   *  3. User clica → /accept-invite/<token> → backend resolve
   *
   * Se o user não existe, cria-o com password null (terá de definir
   * password ao aceitar). Se já existe Membership activa, falha
   * com Conflict — mas se há Membership soft-deleted, re-activa.
   */
  async invite(
    tenantId: string,
    actorUserId: string,
    dto: { email: string; role: Role },
  ) {
    const email = dto.email.toLowerCase().trim();
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

    // Trata soft-deleted como "re-activável"
    const existing = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (existing && !existing.deletedAt && existing.acceptedAt) {
      throw new ConflictException('User already has active membership in tenant');
    }

    // Gera token (mesmo padrão de ContratoColaborador)
    const prefix = randomBytes(4).toString('hex');
    const secret = randomBytes(24).toString('base64url');
    const token = `${prefix}-${secret}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400_000); // 7 dias

    let membership;
    if (existing) {
      // Re-activa: limpa deletedAt + reset invite
      membership = await this.prisma.membership.update({
        where: { id: existing.id },
        data: {
          role: dto.role,
          invitedBy: actorUserId,
          invitedAt: new Date(),
          acceptedAt: null,
          deletedAt: null,
          inviteTokenHash: tokenHash,
          inviteTokenPrefix: prefix,
          inviteExpiresAt: expiresAt,
        },
      });
    } else {
      membership = await this.prisma.membership.create({
        data: {
          userId: user.id,
          tenantId,
          role: dto.role,
          invitedBy: actorUserId,
          invitedAt: new Date(),
          inviteTokenHash: tokenHash,
          inviteTokenPrefix: prefix,
          inviteExpiresAt: expiresAt,
        },
      });
    }

    // Envia email — best-effort
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true },
    });
    const inviter = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { firstName: true, lastName: true, email: true },
    });
    const inviterNome = inviter
      ? `${inviter.firstName} ${inviter.lastName}`.trim() || inviter.email
      : 'A equipa';
    const url = `${process.env.APP_URL ?? 'https://app.kamaia.cc'}/accept-invite/${token}`;
    await this.mail.sendGeneric({
      to: email,
      subject: `Convite para ${tenant?.nome ?? 'Kamaia CLM'}`,
      text:
        `Olá,\n\n${inviterNome} convidou-te a juntares-te a ${tenant?.nome ?? 'um espaço Kamaia'} como ${dto.role}.\n\n` +
        `Aceita o convite (válido 7 dias):\n${url}\n\n` +
        `Se não esperavas este email, ignora-o.\n— Kamaia CLM`,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.MEMBERSHIP,
      entityId: membership.id,
      afterData: { email, role: dto.role, expiresAt: expiresAt.toISOString() },
    });

    return {
      ...membership,
      inviteTokenHash: undefined, // não devolver hash em response
      // Devolvemos o token raw uma única vez — owner pode mostrar /
      // re-partilhar manualmente se o email não chegar
      _inviteToken: token,
      _inviteUrl: url,
    };
  }

  /**
   * AUDIT fix: aceita convite via token magic-link (sem precisar de
   * autenticação prévia se o user já tem password definida; user-
   * provided password se é primeira vez).
   *
   * Devolve a membership + flag se o user precisa de definir password.
   */
  async acceptByToken(token: string, providedPassword?: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const m = await this.prisma.membership.findUnique({
      where: { inviteTokenHash: tokenHash },
      include: { user: true },
    });
    if (!m) throw new UnauthorizedException('Token inválido');
    if (!m.inviteExpiresAt || m.inviteExpiresAt < new Date()) {
      throw new UnauthorizedException('Convite expirado');
    }
    if (m.acceptedAt) {
      throw new BadRequestException('Convite já aceite');
    }

    // Se user não tem password, exige a fornecida
    const needsPassword = !m.user.passwordHash;
    if (needsPassword && (!providedPassword || providedPassword.length < 8)) {
      return {
        needsPassword: true,
        membershipId: m.id,
        userEmail: m.user.email,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      if (needsPassword && providedPassword) {
        const bcrypt = await import('bcrypt');
        const hash = await bcrypt.hash(providedPassword, 12);
        await tx.user.update({
          where: { id: m.userId },
          data: { passwordHash: hash },
        });
      }
      const updated = await tx.membership.update({
        where: { id: m.id },
        data: {
          acceptedAt: new Date(),
          inviteTokenHash: null,
          inviteTokenPrefix: null,
          inviteExpiresAt: null,
        },
      });
      return {
        needsPassword: false,
        membership: updated,
        userEmail: m.user.email,
      };
    });
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
    if (!m || m.tenantId !== tenantId || m.deletedAt) {
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

  /**
   * AUDIT fix: soft-delete em vez de hard. Permite re-convidar mantendo
   * histórico; protege audit log.
   */
  async remove(membershipId: string, tenantId: string, actorUserId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!m || m.tenantId !== tenantId || m.deletedAt) {
      throw new NotFoundException('Membership not found');
    }
    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.MEMBERSHIP,
      entityId: membershipId,
      beforeData: m,
      afterData: updated,
    });
    return { ok: true };
  }

  async accept(userId: string, tenantId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!m || m.deletedAt) throw new NotFoundException('No pending invite');
    if (m.acceptedAt) return m;
    return this.prisma.membership.update({
      where: { id: m.id },
      data: { acceptedAt: new Date() },
    });
  }
}
