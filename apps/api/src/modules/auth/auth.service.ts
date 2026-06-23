import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuditAction,
  EntityType,
  JwtPayload,
  Role,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    // AUDIT fix: política partilhada — Zod só verifica length≥8.
    // Aqui aplicamos a regra completa (maiúscula + dígito) antes de
    // criar o user. Caso contrário tínhamos a estranha situação em
    // que um user registado podia falhar ao tentar mudar a sua
    // própria password porque a política do reset era mais estrita.
    MembershipsService.assertPasswordPolicy(dto.password);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const tenantSlug = this.slugify(dto.tenantName) + '-' + Date.now().toString(36);

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: tenantSlug,
          nome: dto.tenantName,
          nif: dto.tenantNif,
          plan: TenantPlan.STARTER,
          status: TenantStatus.TRIAL,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: Role.ADMIN,
          isDefault: true,
          acceptedAt: new Date(),
        },
      });

      return { user, tenant };
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: EntityType.USER,
      entityId: user.id,
      ip,
    });

    const token = await this.signToken(user.id, user.email);

    return {
      accessToken: token,
      user: this.sanitizeUser(user),
      tenant: { id: tenant.id, slug: tenant.slug, nome: tenant.nome },
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: {
          where: { acceptedAt: { not: null } },
          include: {
            tenant: { select: { id: true, slug: true, nome: true, plan: true } },
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        entityType: EntityType.USER,
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });
      if (shouldLock) {
        await this.audit.log({
          actorUserId: user.id,
          action: AuditAction.ACCOUNT_LOCKED,
          entityType: EntityType.USER,
          entityId: user.id,
          ip,
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      entityType: EntityType.USER,
      entityId: user.id,
      ip,
      userAgent,
    });

    const token = await this.signToken(user.id, user.email);
    const tenants = user.memberships.map((m) => ({
      id: m.tenant.id,
      slug: m.tenant.slug,
      nome: m.tenant.nome,
      plan: m.tenant.plan,
      role: m.role,
      isDefault: m.isDefault,
    }));

    return {
      accessToken: token,
      user: this.sanitizeUser(user),
      tenants,
    };
  }

  private async signToken(userId: string, email: string): Promise<string> {
    const payload: JwtPayload = { sub: userId, email };
    return this.jwt.signAsync(payload);
  }

  private sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash: _omit, ...rest } = user;
    return rest;
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

  // ─── Password reset ──────────────────────────────────────────────

  /**
   * Inicia recuperação de palavra-passe. **Resposta uniforme** —
   * devolvemos sucesso mesmo quando o email não está registado, para
   * evitar enumeração. O lado-cliente nunca consegue distinguir.
   *
   * Gera token raw (24 bytes URL-safe), armazena só o hash SHA-256
   * com prefix (debug) e expira em 1h. Envia link por email via
   * MailService.sendGeneric.
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
    });

    if (user && user.isActive && !user.deletedAt) {
      const rawToken = crypto.randomBytes(24).toString('base64url');
      const prefix = rawToken.slice(0, 8);
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: hash,
          resetTokenPrefix: prefix,
          resetExpiresAt: expires,
        },
      });

      const webBase =
        this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
      const link = `${webBase.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

      const sendResult = await this.mail.sendGeneric({
        to: user.email,
        subject: 'Repor palavra-passe — Kamaia',
        text:
          `Olá ${user.firstName},\n\n` +
          `Recebemos um pedido para repor a tua palavra-passe.\n\n` +
          `Clica no link abaixo (válido durante 1 hora):\n${link}\n\n` +
          `Se não pediste isto, ignora este email — a tua palavra-passe ` +
          `actual continua válida.\n\n— Equipa Kamaia`,
      });

      // Audit log — não loga o token (só prefix); ip preserved
      // separadamente no controller.
      await this.audit.log({
        actorUserId: user.id,
        action: AuditAction.PASSWORD_CHANGE,
        entityType: EntityType.USER,
        entityId: user.id,
        afterData: {
          tokenPrefix: prefix,
          expiresAt: expires.toISOString(),
          mailStubbed: sendResult.stubbed,
        },
      });
    } else if (user) {
      this.logger.warn(
        `forgot-password: user ${normalised} desactivado/eliminado — sem efeito`,
      );
    }

    // Resposta uniforme — caller não distingue se o email existe
    return { ok: true };
  }

  /**
   * Consome o token e define nova palavra-passe.
   *
   * Validações: token hash existe, ainda dentro do TTL, user activo,
   * nova password ≥ 8 chars. Após sucesso:
   *   - actualiza passwordHash
   *   - limpa reset_token_* + zera failedLoginCount + remove lockedUntil
   *   - invalida sessões activas (UserSession.deletedAt)
   *   - audit log
   *
   * Erros: BadRequest com code='INVALID_TOKEN' para token inválido/
   * expirado — front-end mostra mensagem dedicada.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    // AUDIT fix: política partilhada com MembershipsService.acceptByToken
    // — uma única fonte de verdade evita "uma palavra-passe forte
    // chega para o reset mas não para o convite" e vice-versa.
    MembershipsService.assertPasswordPolicy(newPassword);

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findUnique({
      where: { resetTokenHash: hash },
    });

    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        error: 'Token inválido ou expirado.',
      });
    }
    if (!user.isActive || user.deletedAt) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        error: 'Conta inactiva.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenPrefix: null,
          resetExpiresAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      // Invalida sessões — força re-login em todos os dispositivos.
      // (Se UserSession não tiver deletedAt, este updateMany é no-op
      // graças ao filtro `where`.)
      await tx.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: EntityType.USER,
      entityId: user.id,
      afterData: { via: 'reset-token' },
    });

    return { ok: true };
  }
}
