import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { acceptedAt: { not: null } },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                nome: true,
                plan: true,
                parentTenantId: true,
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string;
    },
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    const { passwordHash: _omit, ...rest } = updated;
    return rest;
  }
}
