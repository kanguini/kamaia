import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { AuditService } from '../audit/audit.service';
import {
  Result,
  ok,
  err,
  JwtPayload,
  KamaiaRole,
  AuditAction,
  EntityType,
  SubscriptionPlan,
} from '@kamaia/shared-types';
import { RegisterDto, LoginDto, LoginWithProviderDto } from './auth.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private authRepository: AuthRepository,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async register(
    dto: RegisterDto,
    ip?: string,
    userAgent?: string,
  ): Promise<Result<{ tokens: TokenPair; user: any }>> {
    try {
      // Check if user already exists
      const existingUser = await this.authRepository.findUserByEmail(dto.email);
      if (existingUser) {
        return err('User with this email already exists', 'USER_EXISTS');
      }

      // Create gabinete with FREE plan
      const gabinete = await this.authRepository.createGabinete({
        name: dto.gabineteName,
        plan: SubscriptionPlan.FREE,
      });

      // Hash password
      const passwordHash = await bcrypt.hash(dto.password, 12);

      // Create user with ADVOGADO_SOLO role
      const user = await this.authRepository.createUser({
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: KamaiaRole.ADVOGADO_SOLO,
        gabineteId: gabinete.id,
        oaaNumber: dto.oaaNumber,
        specialty: dto.specialty,
      });

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Create session
      await this.authRepository.createSession(
        user.id,
        tokens.refreshToken,
        userAgent,
        ip,
      );

      // Create initial usage quota
      await this.authRepository.createUsageQuota(gabinete.id);

      // Log audit
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.USER,
        entityId: user.id,
        userId: user.id,
        gabineteId: gabinete.id,
        ip,
        userAgent,
        newValue: { email: user.email, role: user.role },
      });

      const sanitizedUser = this.sanitizeUser(user);

      return ok({ tokens, user: sanitizedUser });
    } catch (error) {
      // Log full stack on the server so Railway tells us exactly why — we
      // keep the client-facing message opaque to avoid leaking schema info.
      const e = error as {
        code?: string;
        message?: string;
        meta?: Record<string, unknown>;
      };
      this.logger.error(
        `Registration failed for ${dto.email}: ${e.code ?? ''} ${e.message ?? ''}`,
        error as Error,
      );

      // Prisma unique-violation on email (P2002) → USER_EXISTS with a friendly reason
      if (e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target)
          ? (e.meta!.target as string[]).join(',')
          : '';
        if (target.includes('email')) {
          return err('User with this email already exists', 'USER_EXISTS');
        }
        if (target.includes('nif')) {
          return err('Gabinete NIF already in use', 'GABINETE_NIF_EXISTS');
        }
        return err('Duplicate value', 'DUPLICATE_VALUE');
      }
      // Missing column / migration out of sync → P2021, P2022
      if (e.code === 'P2021' || e.code === 'P2022') {
        return err(
          'Base de dados desactualizada no servidor. Contacte o administrador.',
          'DB_SCHEMA_OUT_OF_SYNC',
        );
      }

      return err(e.message || 'Registration failed', 'REGISTRATION_FAILED');
    }
  }

  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<Result<{ tokens: TokenPair; user: any }>> {
    try {
      // Find user by email
      const user = await this.authRepository.findUserByEmail(dto.email);
      if (!user) {
        await this.auditService.log({
          action: AuditAction.LOGIN_FAILED,
          entity: EntityType.USER,
          userId: '',
          gabineteId: '',
          ip,
          userAgent,
          newValue: { email: dto.email, reason: 'User not found' },
        });
        return err('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Verify password
      if (!user.passwordHash) {
        await this.auditService.log({
          action: AuditAction.LOGIN_FAILED,
          entity: EntityType.USER,
          entityId: user.id,
          userId: user.id,
          gabineteId: user.gabineteId,
          ip,
          userAgent,
          newValue: { email: dto.email, reason: 'No password set' },
        });
        return err('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isPasswordValid) {
        await this.auditService.log({
          action: AuditAction.LOGIN_FAILED,
          entity: EntityType.USER,
          entityId: user.id,
          userId: user.id,
          gabineteId: user.gabineteId,
          ip,
          userAgent,
          newValue: { email: dto.email, reason: 'Invalid password' },
        });
        return err('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Check user is active
      if (!user.isActive) {
        return err('User account is inactive', 'USER_INACTIVE');
      }

      // Check gabinete is active
      if (!user.gabinete.isActive) {
        return err('Gabinete is inactive', 'GABINETE_INACTIVE');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Create session
      await this.authRepository.createSession(
        user.id,
        tokens.refreshToken,
        userAgent,
        ip,
      );

      // Update last login
      await this.authRepository.updateLastLogin(user.id);

      // Log audit
      await this.auditService.log({
        action: AuditAction.LOGIN,
        entity: EntityType.USER,
        entityId: user.id,
        userId: user.id,
        gabineteId: user.gabineteId,
        ip,
        userAgent,
      });

      const sanitizedUser = this.sanitizeUser(user);

      return ok({ tokens, user: sanitizedUser });
    } catch (error) {
      return err('Login failed', 'LOGIN_FAILED');
    }
  }

  async loginWithProvider(
    dto: LoginWithProviderDto,
    ip?: string,
    userAgent?: string,
  ): Promise<Result<{ tokens: TokenPair; user: any }>> {
    try {
      // Find user by provider
      let user = await this.authRepository.findUserByProvider(dto.provider, dto.providerId);

      if (!user) {
        // Try to find by email
        const existingUser = await this.authRepository.findUserByEmail(dto.email);

        if (existingUser) {
          // Link provider to existing user
          user = await this.authRepository.linkProvider(
            existingUser.id,
            dto.provider,
            dto.providerId,
          );
        } else {
          // Create new gabinete and user
          const gabinete = await this.authRepository.createGabinete({
            name: `${dto.firstName} ${dto.lastName}`,
            plan: SubscriptionPlan.FREE,
          });

          user = await this.authRepository.createUser({
            email: dto.email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: KamaiaRole.ADVOGADO_SOLO,
            gabineteId: gabinete.id,
            provider: dto.provider,
            providerId: dto.providerId,
            avatarUrl: dto.avatarUrl,
          });

          // Create initial usage quota
          await this.authRepository.createUsageQuota(gabinete.id);

          // Log audit
          await this.auditService.log({
            action: AuditAction.CREATE,
            entity: EntityType.USER,
            entityId: user.id,
            userId: user.id,
            gabineteId: gabinete.id,
            ip,
            userAgent,
            newValue: { email: user.email, provider: dto.provider },
          });
        }
      }

      // Check user is active
      if (!user.isActive || !user.gabinete.isActive) {
        return err('User or Gabinete is inactive', 'USER_INACTIVE');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Create session
      await this.authRepository.createSession(
        user.id,
        tokens.refreshToken,
        userAgent,
        ip,
      );

      // Update last login
      await this.authRepository.updateLastLogin(user.id);

      // Log audit
      await this.auditService.log({
        action: AuditAction.LOGIN,
        entity: EntityType.USER,
        entityId: user.id,
        userId: user.id,
        gabineteId: user.gabineteId,
        ip,
        userAgent,
      });

      const sanitizedUser = this.sanitizeUser(user);

      return ok({ tokens, user: sanitizedUser });
    } catch (error) {
      return err('Provider login failed', 'PROVIDER_LOGIN_FAILED');
    }
  }

  async refresh(refreshToken: string): Promise<Result<{ tokens: TokenPair }>> {
    try {
      // Find session by hashed token
      const session = await this.authRepository.findSessionByToken(refreshToken);

      if (!session) {
        return err('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }

      // Check session not expired
      if (session.expiresAt < new Date()) {
        await this.authRepository.deleteSession(session.id);
        return err('Refresh token expired', 'TOKEN_EXPIRED');
      }

      // Check user is active
      if (!session.user.isActive || !session.user.gabinete.isActive) {
        return err('User or Gabinete is inactive', 'USER_INACTIVE');
      }

      // Generate new tokens
      const tokens = this.generateTokens(session.user);

      // Delete old session and create new one (rotation)
      await this.authRepository.deleteSession(session.id);
      await this.authRepository.createSession(
        session.user.id,
        tokens.refreshToken,
        session.userAgent ?? undefined,
        session.ipAddress ?? undefined,
      );

      return ok({ tokens });
    } catch (error) {
      return err('Token refresh failed', 'REFRESH_FAILED');
    }
  }

  async logout(userId: string, ip?: string, userAgent?: string): Promise<Result<void>> {
    try {
      const user = await this.authRepository.findUserById(userId);
      if (!user) {
        return err('User not found', 'USER_NOT_FOUND');
      }

      // Delete all user sessions
      await this.authRepository.deleteAllUserSessions(userId);

      // Log audit
      await this.auditService.log({
        action: AuditAction.LOGOUT,
        entity: EntityType.USER,
        entityId: userId,
        userId,
        gabineteId: user.gabineteId,
        ip,
        userAgent,
      });

      return ok(undefined);
    } catch (error) {
      return err('Logout failed', 'LOGOUT_FAILED');
    }
  }

  async validateJwtPayload(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.authRepository.findUserById(payload.sub);

    if (!user || !user.isActive || !user.gabinete.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      sub: user.id,
      gabineteId: user.gabineteId,
      role: user.role as KamaiaRole,
      email: user.email,
    };
  }

  private generateTokens(user: any): TokenPair {
    const payload: JwtPayload = {
      sub: user.id,
      gabineteId: user.gabineteId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = randomUUID();

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
