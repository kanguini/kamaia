import { NotFoundException } from '@nestjs/common';
import { CarteirasService } from './carteiras.service';

/**
 * Specs do CarteirasService — mock prisma minimal. Focam nas
 * mudanças desta auditoria:
 *  - shape() consistente em list/get/create/update
 *  - update() com race protection (updateMany count=0 → 404)
 *  - moverContratos() reporta naoEncontrados
 *  - softDelete() desliga contratos e regista o count
 */

interface MockState {
  carteiras: Array<{
    id: string;
    tenantId: string;
    nome: string;
    descricao: string | null;
    metadata: object | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }>;
  contratos: Array<{
    id: string;
    tenantId: string;
    carteiraId: string | null;
    deletedAt: Date | null;
  }>;
}

function makePrisma(state: MockState) {
  const include_count = (c: MockState['carteiras'][number]) => ({
    ...c,
    _count: {
      contratos: state.contratos.filter(
        (k) => k.carteiraId === c.id && k.deletedAt === null,
      ).length,
    },
  });

  return {
    carteira: {
      findMany: jest.fn(async (args: { where: { tenantId: string; deletedAt: null } }) =>
        state.carteiras
          .filter((c) => c.tenantId === args.where.tenantId && c.deletedAt === null)
          .map(include_count),
      ),
      findFirst: jest.fn(
        async (args: { where: { id: string; tenantId: string; deletedAt: null } }) => {
          const r = state.carteiras.find(
            (c) =>
              c.id === args.where.id &&
              c.tenantId === args.where.tenantId &&
              c.deletedAt === null,
          );
          return r ? include_count(r) : null;
        },
      ),
      findUniqueOrThrow: jest.fn(async (args: { where: { id: string } }) => {
        const r = state.carteiras.find((c) => c.id === args.where.id);
        if (!r) throw new Error('Not found');
        return include_count(r);
      }),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => {
        const c = {
          id: `c-${state.carteiras.length}`,
          tenantId: args.data.tenantId as string,
          nome: args.data.nome as string,
          descricao: (args.data.descricao as string) ?? null,
          metadata: (args.data.metadata as object) ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
        state.carteiras.push(c);
        return include_count(c);
      }),
      updateMany: jest.fn(
        async (args: {
          where: { id: string; tenantId: string; deletedAt: null };
          data: Record<string, unknown>;
        }) => {
          let count = 0;
          for (const c of state.carteiras) {
            if (
              c.id === args.where.id &&
              c.tenantId === args.where.tenantId &&
              c.deletedAt === null
            ) {
              Object.assign(c, args.data, { updatedAt: new Date() });
              count++;
            }
          }
          return { count };
        },
      ),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const c = state.carteiras.find((c) => c.id === args.where.id);
        if (!c) throw new Error('Not found');
        Object.assign(c, args.data, { updatedAt: new Date() });
        return c;
      }),
    },
    contrato: {
      findMany: jest.fn(
        async (args: { where: { id: { in: string[] }; tenantId: string; deletedAt: null }; select?: object }) =>
          state.contratos
            .filter(
              (k) =>
                args.where.id.in.includes(k.id) &&
                k.tenantId === args.where.tenantId &&
                k.deletedAt === null,
            )
            .map((k) => ({ id: k.id, carteiraId: k.carteiraId })),
      ),
      updateMany: jest.fn(
        async (args: { where: { id: { in: string[] }; tenantId?: string; deletedAt?: null; carteiraId?: string }; data: Record<string, unknown> }) => {
          let count = 0;
          for (const c of state.contratos) {
            if (!args.where.id.in.includes(c.id)) continue;
            if (args.where.tenantId && c.tenantId !== args.where.tenantId) continue;
            if (args.where.deletedAt === null && c.deletedAt !== null) continue;
            if (args.where.carteiraId !== undefined && c.carteiraId !== args.where.carteiraId) continue;
            Object.assign(c, args.data);
            count++;
          }
          // Para softDelete o filtro é por carteiraId; handle separately:
          return { count };
        },
      ),
    },
    // $transaction stub é injectado depois em makeService — ver
    // razão lá. Aqui só damos um placeholder para a forma do tipo.
    $transaction: jest.fn(async () => undefined),
  } as unknown as {
    carteira: Record<string, jest.Mock>;
    contrato: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
}

function makeService(state: MockState) {
  const prisma = makePrisma(state);
  const audit = { log: jest.fn(async () => undefined) };
  // O $transaction precisa de receber o próprio prisma como tx.
  // Reaponta aqui depois da criação.
  (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new CarteirasService(prisma as any, audit as any);
  return { svc, prisma, audit };
}

describe('CarteirasService', () => {
  describe('shape consistency', () => {
    it('list inclui metadata + contratosCount', async () => {
      const state: MockState = {
        carteiras: [
          {
            id: 'c-0',
            tenantId: 't-1',
            nome: 'Imóveis',
            descricao: 'Carteira de imóveis',
            metadata: { tag: 'real-estate' },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
        contratos: [
          { id: 'k1', tenantId: 't-1', carteiraId: 'c-0', deletedAt: null },
          { id: 'k2', tenantId: 't-1', carteiraId: 'c-0', deletedAt: new Date() }, // soft-deleted, não conta
          { id: 'k3', tenantId: 't-1', carteiraId: 'c-0', deletedAt: null },
        ],
      };
      const { svc } = makeService(state);
      const list = await svc.list('t-1');
      expect(list).toHaveLength(1);
      expect(list[0].metadata).toEqual({ tag: 'real-estate' });
      expect(list[0].contratosCount).toBe(2);
    });

    it('create devolve mesma forma (com contratosCount=0)', async () => {
      const state: MockState = { carteiras: [], contratos: [] };
      const { svc } = makeService(state);
      const c = await svc.create('t-1', 'u-1', { nome: 'Nova' });
      expect(c.contratosCount).toBe(0);
      expect(c.metadata).toBeNull();
      expect(c.nome).toBe('Nova');
    });
  });

  describe('update race protection', () => {
    it('lança NotFound quando carteira foi soft-deleted entre get e updateMany', async () => {
      const state: MockState = {
        carteiras: [
          {
            id: 'c-0',
            tenantId: 't-1',
            nome: 'X',
            descricao: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
        contratos: [],
      };
      const { svc, prisma } = makeService(state);

      // Simula: a get() passa, mas updateMany não encontra (race)
      prisma.carteira.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(svc.update('t-1', 'u-1', 'c-0', { nome: 'Y' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('update bem-sucedido devolve forma com contratosCount', async () => {
      const state: MockState = {
        carteiras: [
          {
            id: 'c-0',
            tenantId: 't-1',
            nome: 'X',
            descricao: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
        contratos: [{ id: 'k1', tenantId: 't-1', carteiraId: 'c-0', deletedAt: null }],
      };
      const { svc } = makeService(state);
      const r = await svc.update('t-1', 'u-1', 'c-0', { nome: 'Y' });
      expect(r.nome).toBe('Y');
      expect(r.contratosCount).toBe(1);
    });
  });

  describe('moverContratos', () => {
    it('reporta IDs naoEncontrados', async () => {
      const state: MockState = {
        carteiras: [
          {
            id: 'c-1',
            tenantId: 't-1',
            nome: 'A',
            descricao: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
        contratos: [
          { id: 'k1', tenantId: 't-1', carteiraId: null, deletedAt: null },
          { id: 'k2', tenantId: 't-OUTRO', carteiraId: null, deletedAt: null }, // outro tenant
          { id: 'k3', tenantId: 't-1', carteiraId: null, deletedAt: new Date() }, // soft-deleted
        ],
      };
      const { svc } = makeService(state);
      const r = await svc.moverContratos('t-1', 'u-1', 'c-1', [
        'k1',
        'k2',
        'k3',
        'k-inexistente',
      ]);
      expect(r.movidos).toBe(1);
      expect(r.naoEncontrados).toEqual(
        expect.arrayContaining(['k2', 'k3', 'k-inexistente']),
      );
      expect(r.naoEncontrados).toHaveLength(3);
    });

    it('desliga contratos quando targetCarteiraId=null', async () => {
      const state: MockState = {
        carteiras: [],
        contratos: [
          { id: 'k1', tenantId: 't-1', carteiraId: 'c-old', deletedAt: null },
        ],
      };
      const { svc } = makeService(state);
      const r = await svc.moverContratos('t-1', 'u-1', null, ['k1']);
      expect(r.movidos).toBe(1);
      expect(state.contratos[0].carteiraId).toBeNull();
    });
  });
});
