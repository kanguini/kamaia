import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Webhooks: o tenant subscreve um endpoint que recebe eventos do
 * Kamaia (contrato.assinado, contrato.expira, acto.detectado, etc).
 *
 * Cada delivery é assinado com HMAC SHA-256 (header `X-Kamaia-Signature`)
 * sobre o body, usando o `secret` da subscrição. Retries com exponential
 * backoff (delivery worker em `webhook-delivery.worker.ts`).
 */
@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deliveries: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const w = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!w) throw new NotFoundException('Webhook not found');
    return w;
  }

  /** O secret é gerado server-side e devolvido uma única vez. */
  async create(
    tenantId: string,
    dto: { nome: string; url: string; events: string[] },
  ) {
    const secret = randomBytes(32).toString('base64url');
    const w = await this.prisma.webhook.create({
      data: {
        tenantId,
        nome: dto.nome,
        url: dto.url,
        events: dto.events,
        secret,
      },
    });
    return { ...w, secret };
  }

  async update(
    tenantId: string,
    id: string,
    dto: { nome?: string; url?: string; events?: string[]; isActive?: boolean },
  ) {
    await this.get(tenantId, id);
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.webhook.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Enfileira um evento para entrega a todos os webhooks subscritos.
   * Retorna o número de deliveries criadas.
   *
   * Esta API é a que os outros módulos (Contratos, Compliance, etc)
   * chamam quando algo acontece.
   */
  async enqueueEvent(
    tenantId: string,
    event: string,
    payload: object,
  ): Promise<number> {
    const subs = await this.prisma.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { has: event },
      },
    });
    if (subs.length === 0) return 0;
    await this.prisma.webhookDelivery.createMany({
      data: subs.map((s) => ({
        webhookId: s.id,
        event,
        payload: payload as object,
        status: 'PENDING',
        proximaTentativa: new Date(),
      })),
    });
    return subs.length;
  }
}
