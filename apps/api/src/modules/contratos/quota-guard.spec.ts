import { ForbiddenException } from '@nestjs/common';

/**
 * Quota enforcement nos contratos — Onda A.1.
 *
 * O fluxo real do `ContratosService.create` é monolítico (mais de
 * 150 linhas). Aqui isolamos a lógica do guard de quota para validar
 * os 3 caminhos:
 *   1. Sem UsageQuota → permite (legacy/trial)
 *   2. updateMany devolve 0 + quota existe + atingiu limite → 403
 *   3. updateMany incrementa OK → fluxo segue
 *
 * Mock de Prisma transactional para reproduzir o cenário.
 */

interface MockUsageQuota {
  contratosLimit: number;
  contratosUsado: number;
}

function makeQuotaGuard() {
  // Replica o guard como função pura para teste isolado.
  return async (
    tx: {
      usageQuota: {
        updateMany: jest.Mock;
        findUnique: jest.Mock;
      };
    },
    tenantId: string,
  ): Promise<void> => {
    const quotaUpdate = await tx.usageQuota.updateMany({
      where: { tenantId },
      data: { contratosUsado: { increment: 1 } },
    });
    if (quotaUpdate.count === 0) {
      const q = await tx.usageQuota.findUnique({
        where: { tenantId },
        select: { contratosLimit: true, contratosUsado: true },
      });
      if (q && q.contratosLimit >= 0 && q.contratosUsado >= q.contratosLimit) {
        throw new ForbiddenException(
          `Limite de contratos atingido (${q.contratosUsado}/${q.contratosLimit}). Faz upgrade do plano para criar mais.`,
        );
      }
    }
  };
}

function makeTx(opts: {
  updateCount: number;
  findResult?: MockUsageQuota | null;
}) {
  return {
    usageQuota: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.updateCount }),
      findUnique: jest.fn().mockResolvedValue(opts.findResult ?? null),
    },
  };
}

describe('Contratos quota guard', () => {
  it('permite criar quando updateMany incrementa com sucesso', async () => {
    const guard = makeQuotaGuard();
    const tx = makeTx({ updateCount: 1 });
    await expect(guard(tx, 'tenant-1')).resolves.toBeUndefined();
    expect(tx.usageQuota.updateMany).toHaveBeenCalled();
    expect(tx.usageQuota.findUnique).not.toHaveBeenCalled();
  });

  it('lança 403 quando updateMany devolve 0 e limite atingido', async () => {
    const guard = makeQuotaGuard();
    const tx = makeTx({
      updateCount: 0,
      findResult: { contratosLimit: 50, contratosUsado: 50 },
    });
    await expect(guard(tx, 'tenant-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('mensagem do 403 inclui usado/limite', async () => {
    const guard = makeQuotaGuard();
    const tx = makeTx({
      updateCount: 0,
      findResult: { contratosLimit: 50, contratosUsado: 50 },
    });
    try {
      await guard(tx, 'tenant-1');
      fail('deveria ter lançado');
    } catch (e) {
      expect((e as Error).message).toContain('50/50');
      expect((e as Error).message).toContain('upgrade');
    }
  });

  it('permite quando UsageQuota não existe (tenant em trial)', async () => {
    // updateMany devolve 0 porque não existe quota; findUnique
    // confirma que é null → permite (legacy fallback).
    const guard = makeQuotaGuard();
    const tx = makeTx({ updateCount: 0, findResult: null });
    await expect(guard(tx, 'tenant-1')).resolves.toBeUndefined();
  });

  it('permite quando contratosLimit < 0 (sentinel unlimited)', async () => {
    // No real, o updateMany teria condição OR para contratosLimit < 0.
    // No mock simplificado, devolve count=1 directamente para
    // simular esse path; mas testamos também o caso findUnique
    // devolvendo unlimited.
    const guard = makeQuotaGuard();
    const tx = makeTx({
      updateCount: 0,
      findResult: { contratosLimit: -1, contratosUsado: 999 },
    });
    await expect(guard(tx, 'tenant-1')).resolves.toBeUndefined();
  });
});
