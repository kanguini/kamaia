import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListNotificationsParams {
  cursor?: string;
  limit: number;
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationsRepository {
  constructor(private prisma: PrismaService) {}

  async findNotifications(userId: string, params: ListNotificationsParams) {
    const { cursor, limit, unreadOnly } = params;

    const where: any = { userId };

    if (unreadOnly) {
      where.readAt = null;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        channel: true,
        status: true,
        subject: true,
        body: true,
        metadata: true,
        sentAt: true,
        readAt: true,
        createdAt: true,
      },
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const total = await this.prisma.notification.count({ where });

    return {
      data: items,
      nextCursor,
      total,
    };
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  async markAsRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async createNotification(data: {
    gabineteId: string;
    userId: string;
    prazoId?: string;
    type: string;
    channel: string;
    status: string;
    subject?: string;
    body?: string;
    metadata?: any;
    sentAt?: Date;
    errorMessage?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async updateNotificationStatus(
    id: string,
    status: string,
    metadata?: any,
    errorMessage?: string,
    sentAt?: Date,
  ) {
    return this.prisma.notification.update({
      where: { id },
      data: {
        status,
        ...(metadata && { metadata }),
        ...(errorMessage && { errorMessage }),
        ...(sentAt && { sentAt }),
      },
    });
  }

  async getOrCreatePreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (existing) return existing;

    return this.prisma.notificationPreference.create({
      data: {
        userId,
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        smsOnlyUrgent: true,
      },
    });
  }

  async updatePreferences(
    userId: string,
    data: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      smsEnabled?: boolean;
      smsOnlyUrgent?: boolean;
    },
  ) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  async getSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  async upsertSubscription(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
  ) {
    // Try to find existing by userId + endpoint
    const existing = await this.prisma.pushSubscription.findFirst({
      where: { userId, endpoint },
    });

    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh, auth, userAgent, isActive: true },
      });
    }

    return this.prisma.pushSubscription.create({
      data: { userId, endpoint, p256dh, auth, userAgent },
    });
  }

  async deactivateSubscription(id: string) {
    return this.prisma.pushSubscription.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deleteSubscription(userId: string, id: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { id, userId },
    });
  }

  async getPrazosNeedingAlerts(gabineteId: string) {
    const now = new Date();

    // Find prazos where:
    // - status = PENDENTE
    // - deletedAt null
    // - dueDate > now (not expired yet)
    // - dueDate - alertHoursBefore <= now (alert window reached)
    // - NO notification sent in last 24h for this (prazo, user, type)

    const prazos = await this.prisma.prazo.findMany({
      where: {
        gabineteId,
        status: 'PENDENTE',
        deletedAt: null,
        dueDate: { gt: now },
      },
      include: {
        processo: {
          include: {
            advogado: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Filter by alert window + deduplication
    const result = [];
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const prazo of prazos) {
      if (!prazo.processo.advogado) continue;

      const alertTime = new Date(
        prazo.dueDate.getTime() - prazo.alertHoursBefore * 60 * 60 * 1000,
      );

      if (alertTime > now) continue; // Alert window not reached yet

      // Check if notification already sent in last 24h
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          prazoId: prazo.id,
          userId: prazo.processo.advogado.id,
          createdAt: { gte: oneDayAgo },
        },
      });

      if (!existingNotification) {
        result.push(prazo);
      }
    }

    return result;
  }

  async getAllActiveGabinetes() {
    return this.prisma.gabinete.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
  }
}
