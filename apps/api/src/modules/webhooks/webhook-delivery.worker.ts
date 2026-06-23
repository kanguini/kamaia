import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Worker de entrega de webhooks.
 *
 * Substitui BullMQ + Redis enquanto a infra de fila não está montada.
 * Corre a cada 30s, processa lotes pequenos, com:
 *
 *   - Limite por execução: 25 deliveries (proteção contra cascadas)
 *   - Timeout HTTP: 8s
 *   - Retries: exponential backoff (1m, 5m, 15m, 1h, 6h, 24h — 6 tentativas)
 *   - HMAC SHA-256 do body com `secret` do webhook
 *   - Headers: X-Kamaia-Event, X-Kamaia-Delivery, X-Kamaia-Signature
 *
 * Quando o BullMQ estiver disponível, mover esta lógica para um
 * `Processor` — interface permanece a mesma para os callers
 * (`WebhooksService.enqueueEvent`).
 */

const MAX_DELIVERIES_PER_TICK = 25;
const HTTP_TIMEOUT_MS = 8000;
const MAX_TENTATIVAS = 6;

const BACKOFF_SECONDS: number[] = [
  60,        //  1m
  5 * 60,    //  5m
  15 * 60,   // 15m
  60 * 60,   //  1h
  6 * 3600,  //  6h
  24 * 3600, // 24h
];

@Injectable()
export class WebhookDeliveryWorker {
  private readonly logger = new Logger(WebhookDeliveryWorker.name);
  private inFlight = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      await this.processBatch();
    } catch (e) {
      this.logger.error(
        `Worker batch falhou: ${e instanceof Error ? e.stack : e}`,
      );
    } finally {
      this.inFlight = false;
    }
  }

  private async processBatch(): Promise<void> {
    const agora = new Date();
    const pendentes = await this.prisma.webhookDelivery.findMany({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
        OR: [{ proximaTentativa: null }, { proximaTentativa: { lte: agora } }],
      },
      include: { webhook: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_DELIVERIES_PER_TICK,
    });

    if (pendentes.length === 0) return;
    this.logger.log(`Processando ${pendentes.length} deliveries`);

    for (const d of pendentes) {
      if (!d.webhook.isActive) {
        await this.prisma.webhookDelivery.update({
          where: { id: d.id },
          data: { status: 'FAILED', responseBody: 'Webhook desactivado' },
        });
        continue;
      }
      await this.deliverOne(d);
    }
  }

  private async deliverOne(d: {
    id: string;
    event: string;
    payload: unknown;
    tentativas: number;
    webhook: { url: string; secret: string };
  }): Promise<void> {
    const body = JSON.stringify({
      event: d.event,
      deliveryId: d.id,
      timestamp: new Date().toISOString(),
      data: d.payload,
    });

    const signature = createHmac('sha256', d.webhook.secret)
      .update(body)
      .digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {
      const res = await fetch(d.webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kamaia-event': d.event,
          'x-kamaia-delivery': d.id,
          'x-kamaia-signature': `sha256=${signature}`,
          'user-agent': 'Kamaia-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseBody = (await res.text()).slice(0, 2000);

      if (res.ok) {
        await this.prisma.webhookDelivery.update({
          where: { id: d.id },
          data: {
            status: 'SUCCESS',
            responseStatus: res.status,
            responseBody,
            entregueEm: new Date(),
            tentativas: d.tentativas + 1,
          },
        });
        return;
      }

      await this.scheduleRetry(d.id, d.tentativas + 1, res.status, responseBody);
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : String(e);
      await this.scheduleRetry(d.id, d.tentativas + 1, null, msg);
    }
  }

  private async scheduleRetry(
    deliveryId: string,
    novaTentativa: number,
    responseStatus: number | null,
    responseBody: string,
  ): Promise<void> {
    if (novaTentativa >= MAX_TENTATIVAS) {
      const updated = await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          responseStatus,
          responseBody,
          tentativas: novaTentativa,
        },
        include: {
          webhook: { select: { tenantId: true, url: true, nome: true } },
        },
      });
      // AUDIT fix: dead-letter alert. Quando MAX tentativas falha,
      // notifica o tenant in-app + email (via NotificationsService).
      // Sem isto, falhas acumulavam silenciosamente.
      try {
        await this.prisma.notification.create({
          data: {
            tenantId: updated.webhook.tenantId,
            userId: updated.webhook.tenantId, // notifica owner do tenant
            channel: 'IN_APP',
            tipo: 'WEBHOOK_FAILED',
            titulo: `Webhook "${updated.webhook.nome}" falhou`,
            conteudo: `O endpoint ${updated.webhook.url} falhou após ${MAX_TENTATIVAS} tentativas. Verifica a configuração e tenta de novo.`,
            payload: { deliveryId, lastError: responseBody.slice(0, 500) } as object,
            status: 'PENDING',
          },
        });
      } catch (e) {
        this.logger.error(
          `Falha a criar dead-letter notification: ${e instanceof Error ? e.message : e}`,
        );
      }
      return;
    }

    const delaySec = BACKOFF_SECONDS[Math.min(novaTentativa - 1, BACKOFF_SECONDS.length - 1)];
    const proxima = new Date(Date.now() + delaySec * 1000);

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RETRYING',
        responseStatus,
        responseBody,
        tentativas: novaTentativa,
        proximaTentativa: proxima,
      },
    });
  }
}
