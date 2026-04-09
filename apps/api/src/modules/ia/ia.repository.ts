import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListConversationsParams {
  cursor?: string;
  limit: number;
}

@Injectable()
export class IaRepository {
  constructor(private prisma: PrismaService) {}

  async findConversations(
    gabineteId: string,
    userId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    const where = {
      gabineteId,
      userId,
      deletedAt: null,
    };

    const conversations = await this.prisma.aIConversation.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        context: true,
        contextId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.aIConversation.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async findConversation(gabineteId: string, userId: string, id: string) {
    return this.prisma.aIConversation.findFirst({
      where: {
        id,
        gabineteId,
        userId,
        deletedAt: null,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100, // Last 100 messages
          select: {
            id: true,
            role: true,
            content: true,
            tokenCount: true,
            model: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async createConversation(data: {
    gabineteId: string;
    userId: string;
    title?: string;
    context: string;
    contextId?: string;
  }) {
    return this.prisma.aIConversation.create({
      data,
    });
  }

  async softDeleteConversation(gabineteId: string, userId: string, id: string) {
    return this.prisma.aIConversation.updateMany({
      where: {
        id,
        gabineteId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async createMessage(
    conversationId: string,
    data: {
      role: string;
      content: string;
      tokenCount?: number;
      model?: string;
    },
  ) {
    const message = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        ...data,
      },
    });

    // Touch conversation's updatedAt
    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async updateConversationTitle(id: string, title: string) {
    return this.prisma.aIConversation.update({
      where: { id },
      data: { title },
    });
  }

  async getUsageQuota(gabineteId: string) {
    return this.prisma.usageQuota.findUnique({
      where: { gabineteId },
      include: {
        gabinete: {
          select: { plan: true },
        },
      },
    });
  }

  async incrementAiQueries(gabineteId: string) {
    return this.prisma.usageQuota.update({
      where: { gabineteId },
      data: {
        aiQueriesUsed: { increment: 1 },
      },
    });
  }
}
