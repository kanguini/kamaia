import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
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
}
