import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { assertSafeWebhookUrl } from './url-safety';

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
/** Tecto para o body de resposta lido para audit — evita OOM se o
 * receiver mandar gigabytes. */
const MAX_RESPONSE_BODY_BYTES = 32 * 1024; // 32KB

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

    // AUDIT fix: defesa em profundidade contra SSRF — re-valida URL
    // no momento da entrega. URLs podem ter sido whitelisted no
    // create e depois o owner mudar o DNS para apontar a um IP
    // privado (DNS rebinding). Fazer outra resolução aqui fecha a
    // janela.
    try {
      await assertSafeWebhookUrl(d.webhook.url);
    } catch (e) {
      await this.scheduleRetry(
        d.id,
        d.tentativas + 1,
        null,
        `URL bloqueada por SSRF check: ${(e as Error).message}`,
      );
      return;
    }

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

      // AUDIT fix: stream-bound response read. `await res.text()`
      // ingere o body inteiro em memória — receiver malicioso podia
      // mandar 10GB e provocar OOM. Lê chunks até MAX_RESPONSE_BODY_BYTES
      // e descarta o resto.
      const responseBody = await readBoundedText(res, MAX_RESPONSE_BODY_BYTES);

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
      // AUDIT fix: dead-letter alert. Versão anterior usava
      // `userId: tenantId` — coincidência de UUID criava notification
      // órfã que ninguém via. Agora resolvemos os ADMINs do tenant
      // e criamos uma notification por cada (IN_APP + EMAIL), pelo
      // que o tenant recebe alerta no painel e no email.
      try {
        const admins = await this.prisma.membership.findMany({
          where: {
            tenantId: updated.webhook.tenantId,
            role: 'ADMIN',
            acceptedAt: { not: null },
            deletedAt: null,
          },
          select: { userId: true },
        });
        const titulo = `Webhook "${updated.webhook.nome}" falhou`;
        const conteudo = `O endpoint ${updated.webhook.url} falhou após ${MAX_TENTATIVAS} tentativas. Verifica a configuração e tenta de novo.`;
        const payload = {
          deliveryId,
          lastError: responseBody.slice(0, 500),
          webhookUrl: updated.webhook.url,
        } as object;

        for (const { userId } of admins) {
          for (const channel of ['IN_APP', 'EMAIL'] as const) {
            await this.prisma.notification.create({
              data: {
                tenantId: updated.webhook.tenantId,
                userId,
                channel,
                tipo: 'WEBHOOK_FAILED',
                titulo,
                conteudo,
                payload,
                status: 'PENDING',
              },
            });
          }
        }
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

/**
 * Lê texto da resposta com tecto de bytes. Cancela o reader assim
 * que o limite é atingido, garantindo que receivers maliciosos
 * (10GB em chunks lentos) não esgotam memória nem prendem o tick.
 *
 * Devolve string truncada (com sufixo "…") quando o body excede o
 * limite. Não usa `await res.text()` porque essa função carrega
 * tudo em memória antes de retornar.
 */
async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let out = '';
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          // Decode só até ao limite — descarta o resto.
          const left = maxBytes - (total - value.length);
          if (left > 0) {
            out += decoder.decode(value.subarray(0, left), { stream: false });
          }
          out += '…';
          // Cancela o reader para libertar conexão e parar download.
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          break;
        }
        out += decoder.decode(value, { stream: true });
      }
    }
    out += decoder.decode();
  } catch {
    // Stream interrompido — devolvemos o que temos.
  }
  return out;
}
