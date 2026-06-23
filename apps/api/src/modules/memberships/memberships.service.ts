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

/**
 * MembershipsService — gere associação User↔Tenant + convites.
 *
 * INVARIANTES protegidos por esta auditoria:
 *  1. Cada tenant tem SEMPRE ≥1 ADMIN com acceptedAt!=null e
 *     deletedAt=null. Demote/remove do último ADMIN é rejeitado.
 *  2. Aceitação de convite com password tem política mínima:
 *     ≥8 chars, ≥1 maiúscula, ≥1 dígito. (Caracteres especiais
 *     são encorajados mas não exigidos — evita atritos UX que
 *     forçam users a guardar passwords em ficheiros.)
 *  3. Consumo de token é atómico: `updateMany` com filtro composto
 *     (hash + expira + acceptedAt:null) garante check-and-set sem
 *     race entre duas tabs / dispositivos.
 */
const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  /**
   * Conta ADMINs efectivos do tenant — aceites e não soft-deleted.
   * Usado para proteger o invariante "≥1 ADMIN sempre".
   */
  private async countActiveAdmins(
    tenantId: string,
    excludeMembershipId?: string,
  ): Promise<number> {
    return this.prisma.membership.count({
      where: {
        tenantId,
        role: Role.ADMIN,
        acceptedAt: { not: null },
        deletedAt: null,
        ...(excludeMembershipId && { NOT: { id: excludeMembershipId } }),
      },
    });
  }

  /**
   * Política de password — uma única função para garantir consistência
   * entre acceptByToken, auth.register, auth.resetPassword. Lança
   * BadRequest com mensagem human-friendly em PT.
   */
  static assertPasswordPolicy(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Palavra-passe tem de ter ≥${MIN_PASSWORD_LENGTH} caracteres.`,
      );
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'Palavra-passe tem de ter pelo menos uma letra maiúscula.',
      );
    }
    if (!/\d/.test(password)) {
      throw new BadRequestException(
        'Palavra-passe tem de ter pelo menos um dígito.',
      );
    }
  }

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

    // Se user não tem password, exige a fornecida.
    // Quando falta, devolve "needsPassword" sem aplicar política —
    // o UI mostra primeiro o form, depois retry com password.
    const needsPassword = !m.user.passwordHash;
    if (needsPassword && !providedPassword) {
      return {
        needsPassword: true,
        membershipId: m.id,
        userEmail: m.user.email,
      };
    }
    if (needsPassword && providedPassword) {
      // AUDIT fix: política de password unificada (≥8, +maiúscula, +dígito)
      MembershipsService.assertPasswordPolicy(providedPassword);
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
      // AUDIT fix: consumo atómico do token via updateMany com
      // filtro composto (hash + ainda não aceite + dentro do TTL).
      // Fecha race onde duas tabs / dispositivos tentavam aceitar
      // o mesmo convite — só um vence; o outro recebe count=0 →
      // BadRequest "convite já aceite".
      const r = await tx.membership.updateMany({
        where: {
          id: m.id,
          inviteTokenHash: tokenHash,
          acceptedAt: null,
          inviteExpiresAt: { gt: new Date() },
        },
        data: {
          acceptedAt: new Date(),
          inviteTokenHash: null,
          inviteTokenPrefix: null,
          inviteExpiresAt: null,
        },
      });
      if (r.count === 0) {
        throw new BadRequestException(
          'Convite já foi aceite ou expirou entretanto.',
        );
      }
      const updated = await tx.membership.findUniqueOrThrow({
        where: { id: m.id },
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

    // AUDIT fix: protege invariante "≥1 ADMIN sempre". Demote do
    // último ADMIN deixaria o tenant sem ninguém capaz de gerir
    // memberships, billing, etc. Bloqueamos hard.
    if (m.role === Role.ADMIN && newRole !== Role.ADMIN) {
      const outrosAdmins = await this.countActiveAdmins(tenantId, membershipId);
      if (outrosAdmins === 0) {
        throw new ConflictException(
          'Não é possível remover o último ADMIN do tenant. Promove outro user a ADMIN primeiro.',
        );
      }
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
   *
   * NOVA protecção (esta auditoria): bloqueia remoção do último ADMIN
   * e bloqueia self-remove quando o actor é o único ADMIN. Sem isto,
   * um clique acidental matava o controlo do tenant.
   */
  async remove(membershipId: string, tenantId: string, actorUserId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!m || m.tenantId !== tenantId || m.deletedAt) {
      throw new NotFoundException('Membership not found');
    }

    // Protecção do invariante "≥1 ADMIN sempre"
    if (m.role === Role.ADMIN && m.acceptedAt) {
      const outrosAdmins = await this.countActiveAdmins(tenantId, membershipId);
      if (outrosAdmins === 0) {
        throw new ConflictException(
          'Não é possível remover o último ADMIN do tenant. Promove outro user a ADMIN primeiro.',
        );
      }
    }

    // Protecção contra self-remove sem outro admin a tomar conta
    if (m.userId === actorUserId && m.role === Role.ADMIN) {
      const outrosAdmins = await this.countActiveAdmins(tenantId, membershipId);
      if (outrosAdmins === 0) {
        throw new ConflictException(
          'Não é possível sair como único ADMIN. Promove outro user a ADMIN antes.',
        );
      }
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
