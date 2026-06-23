import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationChannel, NotificationStatus } from '@kamaia/shared-types';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Worker de entrega de notificações.
 *
 * Audit gap: NotificationsService.create() apenas inseria com
 * status=PENDING; nenhum worker fazia a entrega efectiva (Resend para
 * EMAIL, etc.). Resultado: notificações ficavam para sempre PENDING.
 *
 * Este worker:
 *  1. Lê notificações PENDING em batches de 50
 *  2. Tenta entrega segundo o canal:
 *     - EMAIL: via MailService (Resend ou stub)
 *     - IN_APP: nada a entregar (lido pelo cliente via API; só marca SENT)
 *     - PUSH/SMS: ainda não wired — fica PENDING com warn
 *  3. Marca SENT em sucesso, FAILED em erro
 *
 * Não-reentrant: in-flight flag + lease timestamp para tolerar crash
 * mid-tick (se a flag não é libertada em 5min, considera-se stale e
 * o próximo tick assume o lease).
 */
@Injectable()
export class NotificationDeliveryWorker {
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  private inFlight = false;
  private inFlightSince: number | null = null;
  private readonly STALE_MS = 5 * 60 * 1000; // 5min

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Roda a cada minuto. Salvo tests, em dev pode-se reduzir intervalo
   * via env. Para produção, este intervalo é razoável (notificações
   * não são tempo-real crítico, têm SLA implícito de minutos).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    // FIX auditoria: protecção contra inFlight travada por crash.
    // Se o último tick começou há > STALE_MS sem libertar o lease,
    // assumimos crash e libertamos o lease para este tick correr.
    if (this.inFlight && this.inFlightSince !== null) {
      if (Date.now() - this.inFlightSince > this.STALE_MS) {
        this.logger.warn(
          'NotificationDeliveryWorker: lease stale > 5min, assumindo crash anterior — libertando',
        );
        this.inFlight = false;
        this.inFlightSince = null;
      } else {
        return;
      }
    }
    if (this.inFlight) return;
    this.inFlight = true;
    this.inFlightSince = Date.now();

    try {
      await this.processBatch();
    } catch (e) {
      this.logger.error(
        `tick failed: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      this.inFlight = false;
      this.inFlightSince = null;
    }
  }

  async processBatch() {
    const pendentes = await this.prisma.notification.findMany({
      where: { status: NotificationStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    if (pendentes.length === 0) return;

    this.logger.log(`Processando ${pendentes.length} notificações`);

    for (const n of pendentes) {
      try {
        const ok = await this.deliver({
          id: n.id,
          tenantId: n.tenantId,
          userId: n.userId,
          channel: n.channel as NotificationChannel,
          titulo: n.titulo,
          conteudo: n.conteudo,
          payload: n.payload,
        });
        if (ok) {
          await this.prisma.notification.update({
            where: { id: n.id },
            data: { status: NotificationStatus.SENT, enviadoEm: new Date() },
          });
        }
      } catch (e) {
        this.logger.error(
          `Falhou notification ${n.id}: ${e instanceof Error ? e.message : e}`,
        );
        // Notification schema não tem campo erros — guardamos
        // mensagem no payload sob `lastError` para inspecção
        await this.prisma.notification.update({
          where: { id: n.id },
          data: {
            status: NotificationStatus.FAILED,
            payload: {
              ...(typeof n.payload === 'object' && n.payload ? (n.payload as Record<string, unknown>) : {}),
              lastError: e instanceof Error ? e.message : String(e),
            } as object,
          },
        });
      }
    }
  }

  /**
   * Devolve true se a entrega progrediu (SENT) ou foi marcada como
   * tal por o canal não exigir entrega activa (IN_APP). Throw em
   * falhas que devem marcar FAILED.
   */
  private async deliver(n: {
    id: string;
    tenantId: string;
    userId: string;
    channel: NotificationChannel;
    titulo: string;
    conteudo: string;
    payload: unknown;
  }): Promise<boolean> {
    if (n.channel === NotificationChannel.IN_APP) {
      // IN_APP: nada a entregar — frontend consome via API. Marca SENT.
      return true;
    }

    if (n.channel === NotificationChannel.EMAIL) {
      // Resolve email do user
      const user = await this.prisma.user.findUnique({
        where: { id: n.userId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (!user) throw new Error('User not found');
      const result = await this.mail.sendGeneric({
        to: user.email,
        subject: n.titulo,
        text: n.conteudo,
      });
      if (!result.ok && !result.stubbed) {
        throw new Error(result.error ?? 'Mail send failed');
      }
      return true;
    }

    // PUSH / SMS — ainda não wired
    this.logger.warn(`Canal ${n.channel} não suportado — fica PENDING`);
    return false;
  }
}
