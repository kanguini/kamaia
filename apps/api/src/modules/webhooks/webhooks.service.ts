import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertSafeWebhookUrl } from './url-safety';

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

  /**
   * O secret é gerado server-side e devolvido uma única vez.
   *
   * AUDIT fix: URL validada contra SSRF antes de gravar — bloqueia
   * loopback, RFC 1918, metadata endpoints, portas de serviços
   * internos (DB, Redis, etc) e exige https em produção.
   */
  async create(
    tenantId: string,
    dto: { nome: string; url: string; events: string[] },
  ) {
    await assertSafeWebhookUrl(dto.url);
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

  /**
   * AUDIT fix: re-valida URL se vier no update; mesma defesa SSRF
   * que no create. updateMany composto fecha race com soft-delete.
   */
  async update(
    tenantId: string,
    id: string,
    dto: { nome?: string; url?: string; events?: string[]; isActive?: boolean },
  ) {
    await this.get(tenantId, id);
    if (dto.url !== undefined) {
      await assertSafeWebhookUrl(dto.url);
    }
    const r = await this.prisma.webhook.updateMany({
      where: { id, tenantId },
      data: dto,
    });
    if (r.count === 0) throw new NotFoundException('Webhook not found (race)');
    return this.prisma.webhook.findUniqueOrThrow({ where: { id } });
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
   * L.2 — Outbox-style: aceita `tx` opcional para o caller poder
   * executar enqueueEvent DENTRO da sua transaction de domínio.
   * Assim, se o INSERT da entidade de negócio rollback, as deliveries
   * também rollback — garante consistência at-least-once vs lost-on-
   * partial-failure que tínhamos antes (enqueueEvent fora da tx).
   *
   * Os callers em transactions devem passar `tx`; os callers que
   * disparam eventos fora de qualquer transaction (e.g. eventos
   * agendados) podem chamar sem `tx`.
   */
  async enqueueEvent(
    tenantId: string,
    event: string,
    payload: object,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    const subs = await db.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { has: event },
      },
    });
    if (subs.length === 0) return 0;
    await db.webhookDelivery.createMany({
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
