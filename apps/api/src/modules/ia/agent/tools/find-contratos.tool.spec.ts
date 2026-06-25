import { ContratoEstado, Role } from '@prisma/client';
import { buildFindContratosTool } from './find-contratos.tool';
import type { ToolContext } from '../tool.types';

/**
 * Tests da tool find_contratos.
 *
 * Mockamos PrismaService directamente para isolar a lógica da query.
 * Não testamos integração com Postgres aqui (a suite Jest não tem
 * container) — apenas que os argumentos Zod são respeitados, o
 * tenantId vem do ctx, e o output está bem formado.
 */

interface MockPrisma {
  contrato: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
}

function makeMockPrisma(rows: unknown[], total: number): MockPrisma {
  return {
    contrato: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(total),
    },
  };
}

const CTX_BASE: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  role: Role.ADMIN,
  conversationId: 'conv-1',
  messageId: 'msg-1',
};

const ROW_BASE = {
  id: 'ct-1',
  numeroInterno: 'CT-2026-00001',
  titulo: 'Contrato de Agência',
  estado: ContratoEstado.ACTIVO,
  valor: 10_000_000n,
  moeda: 'AOA',
  dataTermo: new Date('2027-06-30'),
  tipo: { codigo: 'CTR_AGENCIA', nome: 'Contrato de Agência' },
};

describe('find_contratos tool', () => {
  it('injecta tenantId do ctx no WHERE (não dos args)', async () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);

    await tool.execute({ search: 'x', limit: 10 } as never, CTX_BASE);

    expect(prisma.contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-A',
          deletedAt: null,
        }),
      }),
    );
  });

  it('passa search como OR em titulo/numeroInterno/descricao', async () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);

    await tool.execute({ search: 'Hexa', limit: 10 } as never, CTX_BASE);

    const call = prisma.contrato.findMany.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(3);
    expect(call.where.OR[0]).toEqual({
      titulo: { contains: 'Hexa', mode: 'insensitive' },
    });
  });

  it('aplica filtro de estado', async () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);

    await tool.execute(
      { estado: ContratoEstado.ACTIVO, limit: 10 } as never,
      CTX_BASE,
    );

    expect(prisma.contrato.findMany.mock.calls[0][0].where.estado).toBe(
      'ACTIVO',
    );
  });

  it('aplica filtro de dataTermo antes/depois', async () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);

    await tool.execute(
      {
        dataTermoAntes: '2027-12-31',
        dataTermoDepois: '2026-01-01',
        limit: 10,
      } as never,
      CTX_BASE,
    );

    const where = prisma.contrato.findMany.mock.calls[0][0].where;
    expect(where.dataTermo).toMatchObject({
      lte: expect.any(Date),
      gte: expect.any(Date),
    });
  });

  it('respeita limit, ordena por dataTermo asc', async () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);

    await tool.execute({ limit: 5 } as never, CTX_BASE);

    expect(prisma.contrato.findMany.mock.calls[0][0].take).toBe(5);
    expect(prisma.contrato.findMany.mock.calls[0][0].orderBy).toEqual([
      { dataTermo: 'asc' },
      { updatedAt: 'desc' },
    ]);
  });

  it('formata output com diasParaTermo + uiPayload', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const row = {
      ...ROW_BASE,
      dataTermo: future,
    };
    const prisma = makeMockPrisma([row], 1);
    const tool = buildFindContratosTool(prisma as never);

    const out = await tool.execute({ limit: 10 } as never, CTX_BASE);

    expect(out.renderHint).toBe('list');
    expect(out.result.contratos).toHaveLength(1);
    expect(out.result.contratos[0].diasParaTermo).toBeGreaterThanOrEqual(29);
    expect(out.result.contratos[0].diasParaTermo).toBeLessThanOrEqual(31);
    expect(out.uiPayload).toMatchObject({
      items: [
        expect.objectContaining({
          href: '/contratos/ct-1',
          label: 'CT-2026-00001 · Contrato de Agência',
        }),
      ],
    });
  });

  it('hint quando 0 resultados sugere criar contrato', async () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);
    const out = await tool.execute(
      { search: 'inexistente', limit: 10 } as never,
      CTX_BASE,
    );
    expect(out.result.hint).toContain('Nenhum');
  });

  it('hint quando total > limit sugere refinar', async () => {
    const prisma = makeMockPrisma([ROW_BASE], 100);
    const tool = buildFindContratosTool(prisma as never);
    const out = await tool.execute({ limit: 10 } as never, CTX_BASE);
    expect(out.result.hint).toContain('refinar');
  });

  it('converte BigInt valor para string (JSON-safe)', async () => {
    const prisma = makeMockPrisma([ROW_BASE], 1);
    const tool = buildFindContratosTool(prisma as never);
    const out = await tool.execute({ limit: 10 } as never, CTX_BASE);
    expect(out.result.contratos[0].valor).toBe('10000000');
    expect(typeof out.result.contratos[0].valor).toBe('string');
  });

  it('roles autorizadas — VIEWER pode invocar, EXTERNAL não', () => {
    const prisma = makeMockPrisma([], 0);
    const tool = buildFindContratosTool(prisma as never);
    expect(tool.requiredRoles).toContain(Role.VIEWER);
    expect(tool.requiredRoles).toContain(Role.ADMIN);
    expect(tool.requiredRoles).not.toContain(Role.EXTERNAL);
    expect(tool.mutates).toBe(false);
  });
});
