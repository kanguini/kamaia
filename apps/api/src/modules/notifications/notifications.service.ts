import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQuery } from './notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria registo de notificação em status PENDING. Um worker futuro
   * (Resend para EMAIL, Twilio para SMS, web-push VAPID para PUSH,
   * SSE/WebSocket para IN_APP) tomará a entrega e moverá para SENT/FAILED.
   */
  async create(params: {
    channel: NotificationChannel;
    type: NotificationType | string;
    userId: string;
    tenantId: string;
    titulo: string;
    conteudo: string;
    payload?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        channel: params.channel,
        tipo: params.type,
        titulo: params.titulo,
        conteudo: params.conteudo,
        payload: params.payload as object | undefined,
        status: NotificationStatus.PENDING,
      },
    });
  }

  async listForUser(
    tenantId: string,
    userId: string,
    q: ListNotificationsQuery,
  ) {
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      userId,
      ...(q.status && { status: q.status }),
      ...(q.channel && { channel: q.channel }),
    };
    const rows = await this.prisma.notification.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, tenantId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        lidoEm: new Date(),
      },
    });
  }

  /**
   * Cria uma notificação de teste em cada canal — útil para o admin
   * validar que o painel renderiza correctamente sem aguardar workers.
   */
  async createTestSet(tenantId: string, userId: string) {
    const created = [];
    for (const channel of Object.values(NotificationChannel)) {
      const n = await this.create({
        channel,
        type: NotificationType.CONTRATO_VENCIMENTO_PROXIMO,
        tenantId,
        userId,
        titulo: `Teste ${channel}`,
        conteudo: `Esta é uma notificação de teste no canal ${channel}.`,
        payload: { test: true, channel },
      });
      created.push(n);
    }
    return { count: created.length, notifications: created };
  }
}
