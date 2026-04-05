import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CursorPaginationParams } from '@kamaia/shared-types';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async findAllByGabinete(gabineteId: string, pagination: CursorPaginationParams) {
    const limit = pagination.limit || 20;

    const where = {
      gabineteId,
      deletedAt: null,
    };

    const users = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      skip: pagination.cursor ? 1 : 0,
      cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        oaaNumber: true,
        specialty: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.user.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findById(gabineteId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        gabineteId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        oaaNumber: true,
        specialty: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
