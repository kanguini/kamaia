import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPlan } from '@kamaia/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PLANS, PlanConfig, quotasForPlan } from './plans.config';

/**
 * BillingService — leitura de subscription + quotas + uso actual.
 *
 * Sprint 4.1: foco em READING (status). Mutações reais (mudar plano,
 * top-up credits, faturação) ficam para sprints futuros quando
 * integrarmos Stripe / multicaixa-pay.
 *
 * Não faz throw em get* — devolve dados pessimistas (plano STARTER
 * sem subscription) para permitir UI funcionar mesmo sem subscription
 * registada (tenant em trial / migração).
 */

export interface BillingStatus {
  plan: TenantPlan;
  planConfig: PlanConfig;
  subscription: {
    status: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelled: boolean;
  };
  usage: {
    contratos: { usado: number; limite: number; pct: number };
    utilizadores: { usado: number; limite: number; pct: number };
    storage: { usadoBytes: string; limiteGB: number; pct: number };
    iaMessages: { usado: number; limite: number; pct: number };
    aiCredits: { usado: number; limite: number; pct: number };
    periodoInicio: string;
    periodoFim: string;
  };
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(tenantId: string): Promise<BillingStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        usageQuota: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const subscription = await this.prisma.subscription
      .findUnique({ where: { tenantId } })
      .catch(() => null);

    // tenant.plan vem do Prisma client com tipo $Enums.TenantPlan;
    // o shared-types TenantPlan tem os mesmos string values.
    const plan = tenant.plan as unknown as TenantPlan;
    const planConfig = PLANS[plan];
    const quotas = quotasForPlan(plan);

    // Se ainda não existe UsageQuota (tenant em trial), usa quotas
    // do plano + 0 usado. Não escrevemos a UsageQuota aqui — fica
    // para o admin endpoint que faz onboarding.
    const q = tenant.usageQuota;

    const contratosUsado = q?.contratosUsado ?? 0;
    const contratosLimit = q?.contratosLimit ?? quotas.contratosLimit;
    const utilizadoresUsado = q?.utilizadoresUsado ?? 0;
    const utilizadoresLimit = q?.utilizadoresLimit ?? quotas.utilizadoresLimit;
    const storageUsado = q?.storageBytesUsado ?? 0n;
    const storageLimit = q?.storageGBLimit ?? quotas.storageGBLimit;
    const iaMessagesUsado = q?.iaMessagesUsado ?? 0;
    const iaMessagesLimit = q?.iaMessagesLimit ?? quotas.iaMessagesLimit;
    const aiCreditsUsado = q?.aiCreditsUsado ?? 0;
    const aiCreditsLimit = q?.aiCreditsLimit ?? quotas.aiCreditsLimit;

    const storageBytesLimit = BigInt(storageLimit) * 1_073_741_824n; // GiB
    const storagePct =
      storageBytesLimit > 0n
        ? Math.round(
            Number((storageUsado * 100n) / storageBytesLimit),
          )
        : 0;

    return {
      plan,
      planConfig,
      subscription: {
        status: subscription?.status ?? null,
        trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
        cancelled: !!subscription?.cancelledAt,
      },
      usage: {
        contratos: {
          usado: contratosUsado,
          limite: contratosLimit,
          pct: pct(contratosUsado, contratosLimit),
        },
        utilizadores: {
          usado: utilizadoresUsado,
          limite: utilizadoresLimit,
          pct: pct(utilizadoresUsado, utilizadoresLimit),
        },
        storage: {
          usadoBytes: storageUsado.toString(),
          limiteGB: storageLimit,
          pct: storagePct,
        },
        iaMessages: {
          usado: iaMessagesUsado,
          limite: iaMessagesLimit,
          pct: pct(iaMessagesUsado, iaMessagesLimit),
        },
        aiCredits: {
          usado: aiCreditsUsado,
          limite: aiCreditsLimit,
          pct: pct(aiCreditsUsado, aiCreditsLimit),
        },
        periodoInicio:
          q?.periodoInicio.toISOString().slice(0, 10) ??
          new Date().toISOString().slice(0, 10),
        periodoFim:
          q?.periodoFim.toISOString().slice(0, 10) ??
          new Date().toISOString().slice(0, 10),
      },
    };
  }
}

function pct(usado: number, limite: number): number {
  if (limite <= 0) return 0;
  return Math.min(100, Math.round((usado * 100) / limite));
}
