import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class AuthRepository {
  constructor(private prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        gabinete: {
          select: {
            id: true,
            name: true,
            isActive: true,
            plan: true,
          },
        },
      },
    });
  }

  async findUserById(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        gabinete: {
          select: {
            id: true,
            name: true,
            isActive: true,
            plan: true,
          },
        },
      },
    });
  }

  async findUserByProvider(provider: string, providerId: string) {
    return this.prisma.user.findFirst({
      where: { provider, providerId, deletedAt: null },
      include: {
        gabinete: {
          select: {
            id: true,
            name: true,
            isActive: true,
            plan: true,
          },
        },
      },
    });
  }

  async createUser(data: {
    email: string;
    passwordHash?: string;
    firstName: string;
    lastName: string;
    role: string;
    gabineteId: string;
    oaaNumber?: string;
    specialty?: string;
    provider?: string;
    providerId?: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.create({
      data,
      include: {
        gabinete: {
          select: {
            id: true,
            name: true,
            isActive: true,
            plan: true,
          },
        },
      },
    });
  }

  async createGabinete(data: { name: string; plan: string }) {
    return this.prisma.gabinete.create({
      data,
    });
  }

  async createUsageQuota(gabineteId: string) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.usageQuota.create({
      data: {
        gabineteId,
        periodStart: now,
        periodEnd,
      },
    });
  }

  async linkProvider(userId: string, provider: string, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { provider, providerId },
      include: {
        gabinete: {
          select: {
            id: true,
            name: true,
            isActive: true,
            plan: true,
          },
        },
      },
    });
  }

  async createSession(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
    expiresAt?: Date,
  ) {
    const hashedToken = this.hashToken(refreshToken);
    const expiryDate = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return this.prisma.userSession.create({
      data: {
        userId,
        refreshToken: hashedToken,
        userAgent,
        ipAddress,
        expiresAt: expiryDate,
      },
    });
  }

  async findSessionByToken(refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);

    return this.prisma.userSession.findFirst({
      where: { refreshToken: hashedToken },
      include: {
        user: {
          include: {
            gabinete: {
              select: {
                id: true,
                name: true,
                isActive: true,
                plan: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteSession(sessionId: string) {
    return this.prisma.userSession.delete({
      where: { id: sessionId },
    });
  }

  async deleteAllUserSessions(userId: string) {
    return this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
