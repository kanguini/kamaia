import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  AuditAction,
  EntityType,
} from '@kamaia/shared-types';
import {
  UpdatePreferencesDto,
  SubscribePushDto,
  ListNotificationsDto,
} from './notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private repo: NotificationsRepository,
    private emailProvider: EmailProvider,
    private smsProvider: SmsProvider,
    private pushProvider: PushProvider,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async listNotifications(
    userId: string,
    params: ListNotificationsDto,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const result = await this.repo.findNotifications(userId, params);
      return ok(result);
    } catch (error) {
      return err('Failed to fetch notifications', 'NOTIFICATIONS_FETCH_FAILED');
    }
  }

  async getUnreadCount(userId: string): Promise<Result<number>> {
    try {
      const count = await this.repo.countUnread(userId);
      return ok(count);
    } catch (error) {
      return err('Failed to count unread', 'UNREAD_COUNT_FAILED');
    }
  }

  async markAsRead(userId: string, id: string): Promise<Result<void>> {
    try {
      await this.repo.markAsRead(userId, id);
      return ok(undefined);
    } catch (error) {
      return err('Failed to mark as read', 'MARK_READ_FAILED');
    }
  }

  async getPreferences(userId: string): Promise<Result<any>> {
    try {
      const prefs = await this.repo.getOrCreatePreferences(userId);
      return ok(prefs);
    } catch (error) {
      return err('Failed to fetch preferences', 'PREFERENCES_FETCH_FAILED');
    }
  }

  async updatePreferences(
    userId: string,
    gabineteId: string,
    dto: UpdatePreferencesDto,
  ): Promise<Result<any>> {
    try {
      // Ensure preferences exist
      await this.repo.getOrCreatePreferences(userId);

      const updated = await this.repo.updatePreferences(userId, dto);

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.USER,
        entityId: userId,
        userId,
        gabineteId,
        oldValue: {},
        newValue: { notificationPreferences: dto },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to update preferences', 'PREFERENCES_UPDATE_FAILED');
    }
  }

  async subscribePush(
    userId: string,
    gabineteId: string,
    dto: SubscribePushDto,
    userAgent?: string,
  ): Promise<Result<any>> {
    try {
      const subscription = await this.repo.upsertSubscription(
        userId,
        dto.endpoint,
        dto.keys.p256dh,
        dto.keys.auth,
        userAgent,
      );

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.USER,
        entityId: userId,
        userId,
        gabineteId,
        newValue: { pushSubscription: true },
      });

      return ok(subscription);
    } catch (error) {
      return err('Failed to subscribe push', 'PUSH_SUBSCRIBE_FAILED');
    }
  }

  async unsubscribePush(
    userId: string,
    gabineteId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      await this.repo.deleteSubscription(userId, id);

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.USER,
        entityId: userId,
        userId,
        gabineteId,
        oldValue: { pushSubscription: id },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to unsubscribe push', 'PUSH_UNSUBSCRIBE_FAILED');
    }
  }

  async sendTestNotification(
    gabineteId: string,
    userId: string,
  ): Promise<Result<{ email: any; sms: any; push: any }>> {
    try {
      // Get user
      const user = await this.prisma.user.findFirst({
        where: { id: userId, gabineteId },
      });

      if (!user) {
        return err('User not found', 'USER_NOT_FOUND');
      }

      // Get preferences
      const prefs = await this.repo.getOrCreatePreferences(userId);

      const results: any = { email: null, sms: null, push: null };

      // Email
      if (prefs.emailEnabled && user.email) {
        const subject = 'Kamaia — Notificacao de Teste';
        const html = this.buildTestEmailHtml(user.firstName);
        const emailResult = await this.emailProvider.send(
          user.email,
          subject,
          html,
        );

        const notification = await this.repo.createNotification({
          gabineteId,
          userId,
          type: NotificationType.TEST,
          channel: NotificationChannel.EMAIL,
          status:
            emailResult.status === 'SENT'
              ? NotificationStatus.SENT
              : emailResult.status === 'DRY_RUN'
                ? NotificationStatus.DRY_RUN
                : NotificationStatus.FAILED,
          subject,
          body: html,
          metadata: emailResult.metadata,
          sentAt: emailResult.status === 'SENT' ? new Date() : undefined,
          errorMessage: emailResult.errorMessage,
        });

        results.email = { status: emailResult.status, id: notification.id };
      }

      // SMS
      if (prefs.smsEnabled && user.phone) {
        const body = `Kamaia: Notificacao de teste. Sistema de alertas configurado com sucesso.`;
        const smsResult = await this.smsProvider.send(user.phone, body);

        const notification = await this.repo.createNotification({
          gabineteId,
          userId,
          type: NotificationType.TEST,
          channel: NotificationChannel.SMS,
          status:
            smsResult.status === 'SENT'
              ? NotificationStatus.SENT
              : smsResult.status === 'DRY_RUN'
                ? NotificationStatus.DRY_RUN
                : NotificationStatus.FAILED,
          body,
          metadata: smsResult.metadata,
          sentAt: smsResult.status === 'SENT' ? new Date() : undefined,
          errorMessage: smsResult.errorMessage,
        });

        results.sms = { status: smsResult.status, id: notification.id };
      }

      // Push
      if (prefs.pushEnabled) {
        const subscriptions = await this.repo.getSubscriptions(userId);
        const pushResults = [];

        for (const sub of subscriptions) {
          const payload = {
            title: 'Kamaia — Teste',
            body: 'Sistema de notificacoes push configurado com sucesso.',
            icon: '/icon-192.png',
          };

          const pushResult = await this.pushProvider.sendToSubscription(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );

          const notification = await this.repo.createNotification({
            gabineteId,
            userId,
            type: NotificationType.TEST,
            channel: NotificationChannel.PUSH,
            status:
              pushResult.status === 'SENT'
                ? NotificationStatus.SENT
                : pushResult.status === 'DRY_RUN'
                  ? NotificationStatus.DRY_RUN
                  : NotificationStatus.FAILED,
            body: payload.body,
            metadata: pushResult.metadata,
            sentAt: pushResult.status === 'SENT' ? new Date() : undefined,
            errorMessage: pushResult.errorMessage,
          });

          pushResults.push({
            status: pushResult.status,
            id: notification.id,
          });

          // Deactivate expired subscriptions
          if (pushResult.metadata?.expired) {
            await this.repo.deactivateSubscription(sub.id);
          }
        }

        results.push = pushResults;
      }

      return ok(results);
    } catch (error) {
      return err('Failed to send test notification', 'TEST_NOTIFICATION_FAILED');
    }
  }

  async sendPrazoAlert(
    gabineteId: string,
    userId: string,
    prazo: any,
    type: NotificationType,
  ): Promise<Result<void>> {
    try {
      // Get user
      const user = await this.prisma.user.findFirst({
        where: { id: userId, gabineteId },
      });

      if (!user) {
        return err('User not found', 'USER_NOT_FOUND');
      }

      // Get preferences
      const prefs = await this.repo.getOrCreatePreferences(userId);

      // Email
      if (prefs.emailEnabled && user.email) {
        const subject = this.buildEmailSubject(prazo, type);
        const html = this.buildEmailHtml(prazo, type);
        const emailResult = await this.emailProvider.send(
          user.email,
          subject,
          html,
        );

        await this.repo.createNotification({
          gabineteId,
          userId,
          prazoId: prazo.id,
          type,
          channel: NotificationChannel.EMAIL,
          status:
            emailResult.status === 'SENT'
              ? NotificationStatus.SENT
              : emailResult.status === 'DRY_RUN'
                ? NotificationStatus.DRY_RUN
                : NotificationStatus.FAILED,
          subject,
          body: html,
          metadata: emailResult.metadata,
          sentAt: emailResult.status === 'SENT' ? new Date() : undefined,
          errorMessage: emailResult.errorMessage,
        });
      }

      // SMS
      if (prefs.smsEnabled && user.phone) {
        // Skip SMS if smsOnlyUrgent and prazo not urgent
        if (prefs.smsOnlyUrgent && !prazo.isUrgent) {
          // Skip
        } else {
          const body = this.buildSmsBody(prazo);
          const smsResult = await this.smsProvider.send(user.phone, body);

          await this.repo.createNotification({
            gabineteId,
            userId,
            prazoId: prazo.id,
            type,
            channel: NotificationChannel.SMS,
            status:
              smsResult.status === 'SENT'
                ? NotificationStatus.SENT
                : smsResult.status === 'DRY_RUN'
                  ? NotificationStatus.DRY_RUN
                  : NotificationStatus.FAILED,
            body,
            metadata: smsResult.metadata,
            sentAt: smsResult.status === 'SENT' ? new Date() : undefined,
            errorMessage: smsResult.errorMessage,
          });
        }
      }

      // Push
      if (prefs.pushEnabled) {
        const subscriptions = await this.repo.getSubscriptions(userId);

        for (const sub of subscriptions) {
          const payload = this.buildPushPayload(prazo, type);

          const pushResult = await this.pushProvider.sendToSubscription(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );

          await this.repo.createNotification({
            gabineteId,
            userId,
            prazoId: prazo.id,
            type,
            channel: NotificationChannel.PUSH,
            status:
              pushResult.status === 'SENT'
                ? NotificationStatus.SENT
                : pushResult.status === 'DRY_RUN'
                  ? NotificationStatus.DRY_RUN
                  : NotificationStatus.FAILED,
            body: payload.body,
            metadata: pushResult.metadata,
            sentAt: pushResult.status === 'SENT' ? new Date() : undefined,
            errorMessage: pushResult.errorMessage,
          });

          // Deactivate expired subscriptions
          if (pushResult.metadata?.expired) {
            await this.repo.deactivateSubscription(sub.id);
          }
        }
      }

      return ok(undefined);
    } catch (error) {
      return err('Failed to send prazo alert', 'PRAZO_ALERT_FAILED');
    }
  }

  getVapidPublicKey(): string {
    return this.pushProvider.publicKey;
  }

  // ── Helper Methods ─────────────────────────────────────────

  private buildTestEmailHtml(firstName: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FAFAF8; color: #0D0D0D;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C8872A;">
    <h1 style="font-family: Georgia, serif; color: #C8872A; margin: 0;">Kamaia</h1>
    <p style="color: #6B6660; margin: 5px 0 0 0; font-size: 12px;">Gestao Juridica Inteligente</p>
  </div>
  <div style="padding: 30px 20px;">
    <h2 style="color: #0D0D0D;">Ola, ${firstName}!</h2>
    <p style="font-size: 16px;">Este e um email de teste do sistema de notificacoes Kamaia.</p>
    <p style="color: #6B6660;">Se recebeu este email, significa que as suas preferencias de notificacao estao configuradas correctamente.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${frontendUrl}/configuracoes" style="background: #C8872A; color: #0D0D0D; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Gerir Preferencias</a>
    </div>
  </div>
  <div style="padding: 20px; border-top: 1px solid #E2DDD6; text-align: center; color: #6B6660; font-size: 12px;">
    <p>Kamaia — Gestao Juridica Inteligente</p>
  </div>
</body></html>`;
  }

  private buildEmailSubject(prazo: any, type: string): string {
    if (type === NotificationType.PRAZO_CRITICAL) {
      return `URGENTE: ${prazo.title}`;
    }
    if (type === NotificationType.PRAZO_TODAY) {
      return `Prazo HOJE: ${prazo.title}`;
    }
    return `Alerta de Prazo: ${prazo.title}`;
  }

  private buildEmailHtml(prazo: any, type: string): string {
    const dueDate = new Date(prazo.dueDate).toLocaleString('pt-PT', {
      timeZone: 'Africa/Luanda',
    });
    const hoursUntil = Math.round(
      (new Date(prazo.dueDate).getTime() - Date.now()) / (1000 * 60 * 60),
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const typeLabel =
      type === NotificationType.PRAZO_CRITICAL
        ? 'Prazo URGENTE'
        : type === NotificationType.PRAZO_TODAY
          ? 'Prazo Hoje'
          : 'Alerta de Prazo';

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FAFAF8; color: #0D0D0D;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C8872A;">
    <h1 style="font-family: Georgia, serif; color: #C8872A; margin: 0;">Kamaia</h1>
    <p style="color: #6B6660; margin: 5px 0 0 0; font-size: 12px;">Gestao Juridica Inteligente</p>
  </div>
  <div style="padding: 30px 20px;">
    <h2 style="color: #C0392B;">${typeLabel}</h2>
    <p style="font-size: 16px;"><strong>${prazo.title}</strong></p>
    <p style="color: #6B6660;">${prazo.description || ''}</p>
    <div style="background: #F0EDE6; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Processo:</strong> ${prazo.processo.processoNumber} — ${prazo.processo.title}</p>
      <p style="margin: 5px 0;"><strong>Data limite:</strong> ${dueDate}</p>
      <p style="margin: 5px 0;"><strong>Faltam:</strong> ${hoursUntil} horas</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${frontendUrl}/prazos/${prazo.id}" style="background: #C8872A; color: #0D0D0D; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Prazo</a>
    </div>
  </div>
  <div style="padding: 20px; border-top: 1px solid #E2DDD6; text-align: center; color: #6B6660; font-size: 12px;">
    <p>Recebeu este email porque tem alertas de prazos activados no Kamaia.</p>
    <p><a href="${frontendUrl}/configuracoes" style="color: #C8872A;">Gerir preferencias</a></p>
  </div>
</body></html>`;
  }

  private buildSmsBody(prazo: any): string {
    const dueDate = new Date(prazo.dueDate).toLocaleDateString('pt-PT', {
      timeZone: 'Africa/Luanda',
    });
    const hoursUntil = Math.round(
      (new Date(prazo.dueDate).getTime() - Date.now()) / (1000 * 60 * 60),
    );

    return `Kamaia: Prazo "${prazo.title}" — ${prazo.processo.processoNumber}. Limite: ${dueDate} (${hoursUntil}h).`;
  }

  private buildPushPayload(
    prazo: any,
    type: string,
  ): { title: string; body: string; url?: string; icon?: string } {
    const hoursUntil = Math.round(
      (new Date(prazo.dueDate).getTime() - Date.now()) / (1000 * 60 * 60),
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const title =
      type === NotificationType.PRAZO_CRITICAL
        ? `URGENTE: ${prazo.title}`
        : type === NotificationType.PRAZO_TODAY
          ? `Prazo HOJE: ${prazo.title}`
          : `Alerta: ${prazo.title}`;

    const body = `${prazo.processo.processoNumber} — Faltam ${hoursUntil}h`;

    return {
      title,
      body,
      url: `${frontendUrl}/prazos/${prazo.id}`,
      icon: '/icon-192.png',
    };
  }
}
