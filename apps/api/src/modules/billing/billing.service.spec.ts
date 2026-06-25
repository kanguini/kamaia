import { NotFoundException } from '@nestjs/common';
import { TenantPlan, PLAN_LIMITS, PLAN_AI_CREDITS } from '@kamaia/shared-types';
import { BillingService } from './billing.service';
import { PLANS } from './plans.config';

/**
 * Tests do BillingService — leitura defensiva sem quebrar a UI
 * quando UsageQuota ainda não existe.
 */

function makePrisma(opts: {
  tenant?: { id: string; plan: TenantPlan; usageQuota?: unknown } | null;
  subscription?: unknown | null;
}) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(opts.tenant ?? null),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue(opts.subscription ?? null),
    },
  };
}

describe('BillingService', () => {
  it('lança 404 quando o tenant não existe', async () => {
    const prisma = makePrisma({ tenant: null });
    const svc = new BillingService(prisma as never);
    await expect(svc.getStatus('any')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devolve status com fallback de quotas do plano quando não há UsageQuota', async () => {
    const prisma = makePrisma({
      tenant: { id: 't1', plan: TenantPlan.STARTER, usageQuota: null },
    });
    const svc = new BillingService(prisma as never);
    const status = await svc.getStatus('t1');

    expect(status.plan).toBe(TenantPlan.STARTER);
    expect(status.planConfig).toBe(PLANS[TenantPlan.STARTER]);
    expect(status.usage.contratos.limite).toBe(PLANS[TenantPlan.STARTER].quotas.contratosLimit);
    expect(status.usage.contratos.usado).toBe(0);
    expect(status.usage.aiCredits.limite).toBe(PLANS[TenantPlan.STARTER].quotas.aiCreditsLimit);
  });

  it('reflecte uso real quando UsageQuota existe', async () => {
    const usageQuota = {
      contratosUsado: 25,
      contratosLimit: 50,
      utilizadoresUsado: 2,
      utilizadoresLimit: 3,
      storageBytesUsado: 524_288_000n, // 500 MB
      storageGBLimit: 1,
      iaMessagesUsado: 47,
      iaMessagesLimit: 100,
      aiCreditsUsado: 35,
      aiCreditsLimit: 100,
      periodoInicio: new Date('2026-06-01'),
      periodoFim: new Date('2026-06-30'),
    };
    const prisma = makePrisma({
      tenant: { id: 't1', plan: TenantPlan.STARTER, usageQuota },
    });
    const svc = new BillingService(prisma as never);
    const status = await svc.getStatus('t1');

    expect(status.usage.contratos).toEqual({ usado: 25, limite: 50, pct: 50 });
    expect(status.usage.iaMessages).toEqual({ usado: 47, limite: 100, pct: 47 });
    expect(status.usage.aiCredits).toEqual({ usado: 35, limite: 100, pct: 35 });
    expect(status.usage.storage.pct).toBeGreaterThanOrEqual(46);
    expect(status.usage.storage.pct).toBeLessThanOrEqual(49);
  });

  it('pct nunca passa 100% mesmo com over-usage', async () => {
    const usageQuota = {
      contratosUsado: 999,
      contratosLimit: 50,
      utilizadoresUsado: 0,
      utilizadoresLimit: 3,
      storageBytesUsado: 0n,
      storageGBLimit: 1,
      iaMessagesUsado: 0,
      iaMessagesLimit: 100,
      aiCreditsUsado: 0,
      aiCreditsLimit: 100,
      periodoInicio: new Date(),
      periodoFim: new Date(),
    };
    const prisma = makePrisma({
      tenant: { id: 't1', plan: TenantPlan.STARTER, usageQuota },
    });
    const svc = new BillingService(prisma as never);
    const status = await svc.getStatus('t1');
    expect(status.usage.contratos.pct).toBe(100);
  });

  it('inclui dados de subscription quando existe', async () => {
    const trialEnd = new Date('2026-07-01');
    const periodEnd = new Date('2026-08-01');
    const prisma = makePrisma({
      tenant: { id: 't1', plan: TenantPlan.GROWTH, usageQuota: null },
      subscription: {
        status: 'ACTIVE',
        trialEndsAt: trialEnd,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      },
    });
    const svc = new BillingService(prisma as never);
    const status = await svc.getStatus('t1');
    expect(status.subscription.status).toBe('ACTIVE');
    expect(status.subscription.trialEndsAt).toBe(trialEnd.toISOString());
    expect(status.subscription.cancelled).toBe(false);
  });
});

describe('PLANS config', () => {
  it('todos os 5 planos definidos têm quotas', () => {
    // Onda A.2: `-1` é sentinel "unlimited" canónico em shared-types.
    // Aceitamos qualquer valor não-zero positivo OU -1.
    const isValidLimit = (v: number) => v === -1 || v > 0;
    for (const plan of Object.values(TenantPlan)) {
      expect(PLANS[plan].quotas).toBeDefined();
      expect(isValidLimit(PLANS[plan].quotas.contratosLimit)).toBe(true);
      expect(PLANS[plan].quotas.aiCreditsLimit).toBeGreaterThanOrEqual(0);
    }
  });

  it('PLANS.quotas deriva de PLAN_LIMITS (single source of truth)', () => {
    // Onda A.2: garantir que ninguém pode acidentalmente atribuir
    // um valor inconsistente em PLANS sem actualizar shared-types.
    for (const plan of Object.values(TenantPlan)) {
      const limits = PLAN_LIMITS[plan];
      const ai = PLAN_AI_CREDITS[plan];
      expect(PLANS[plan].quotas.contratosLimit).toBe(limits.contratos);
      expect(PLANS[plan].quotas.utilizadoresLimit).toBe(limits.utilizadores);
      expect(PLANS[plan].quotas.storageGBLimit).toBe(limits.storageGB);
      expect(PLANS[plan].quotas.iaMessagesLimit).toBe(limits.iaMessages);
      expect(PLANS[plan].quotas.aiCreditsLimit).toBe(ai);
    }
  });

  it('preço cresce monotonicamente nos planos públicos pagos', () => {
    const paid = [
      TenantPlan.STARTER,
      TenantPlan.GROWTH,
      TenantPlan.SCALE,
      TenantPlan.ENTERPRISE,
    ];
    for (let i = 1; i < paid.length; i++) {
      expect(PLANS[paid[i]].precoMensalCentavos).toBeGreaterThan(
        PLANS[paid[i - 1]].precoMensalCentavos,
      );
    }
  });
});
