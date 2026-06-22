import { NotFoundException } from '@nestjs/common';
import { ContratoPartesService } from './partes/partes.service';
import { ContratoAssinaturasService } from './assinaturas/assinaturas.service';
import { ContratoComentariosService } from './comentarios/comentarios.service';

/**
 * Cobertura dos fixes de segurança encontrados na auditoria interna:
 *
 * AUDIT.1 — partes.remove tinha tenant-leak (delete por id-só)
 * AUDIT.2 — assinaturas.get tinha cross-contrato-leak (findUnique por id-só)
 * AUDIT.3 — assinaturas.list aceita tenantId para defense in depth
 * AUDIT.4 — comentarios.list aceita tenantId para defense in depth
 *
 * Mockamos o prisma sem container Postgres — assertamos shape das
 * queries (where clauses correctas).
 */

function makePrisma(overrides: Record<string, Record<string, jest.Mock>> = {}): unknown {
  return {
    contrato: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
    contratoParte: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    contratoAssinatura: {
      findFirst: jest.fn().mockResolvedValue({ id: 'a1', contratoId: 'c1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    contratoComentario: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    contratoEvento: {
      create: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

describe('AUDIT.1 — partes.remove valida contratoId↔parteId', () => {
  it('apaga só quando id+contratoId batem (deleteMany filter)', async () => {
    const prisma = makePrisma() as { contratoParte: { deleteMany: jest.Mock }; contrato: { findFirst: jest.Mock }; contratoEvento: { create: jest.Mock } };
    const svc = new ContratoPartesService(prisma as unknown as never);
    await svc.remove('t1', 'u1', 'c1', 'p1');
    expect(prisma.contratoParte.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1', contratoId: 'c1' },
      }),
    );
  });

  it('throw 404 quando parteId não pertence ao contratoId (count=0)', async () => {
    const prisma = makePrisma({
      contratoParte: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    }) as unknown;
    const svc = new ContratoPartesService(prisma as never);
    await expect(svc.remove('t1', 'u1', 'c1', 'p-outro')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('AUDIT.2 — assinaturas.get cross-check contrato↔tenant', () => {
  it('aceita params extra contratoId + tenantId e usa-os em findFirst', async () => {
    const prisma = makePrisma() as { contratoAssinatura: { findFirst: jest.Mock } };
    const svc = new ContratoAssinaturasService(
      prisma as unknown as never,
      { enqueueEvent: jest.fn() } as unknown as never,
    );
    await svc.get('a1', 'c1', 't1');
    const callArg = prisma.contratoAssinatura.findFirst.mock.calls[0][0];
    expect(callArg.where).toMatchObject({
      id: 'a1',
      contratoId: 'c1',
      contrato: { tenantId: 't1', deletedAt: null },
    });
  });

  it('throw 404 quando a assinatura não bate (findFirst devolve null)', async () => {
    const prisma = makePrisma({
      contratoAssinatura: { findFirst: jest.fn().mockResolvedValue(null) },
    }) as unknown;
    const svc = new ContratoAssinaturasService(
      prisma as never,
      { enqueueEvent: jest.fn() } as unknown as never,
    );
    await expect(svc.get('a-de-outro-tenant', 'c1', 't1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('AUDIT.3 — assinaturas.list aceita tenantId (defense in depth)', () => {
  it('quando tenantId passado, filtra via contrato.tenantId', async () => {
    const prisma = makePrisma() as { contratoAssinatura: { findMany: jest.Mock } };
    const svc = new ContratoAssinaturasService(
      prisma as unknown as never,
      { enqueueEvent: jest.fn() } as unknown as never,
    );
    await svc.list('c1', 't1');
    const where = prisma.contratoAssinatura.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      contratoId: 'c1',
      contrato: { tenantId: 't1', deletedAt: null },
    });
  });

  it('sem tenantId (back-compat), filtra só por contratoId', async () => {
    const prisma = makePrisma() as { contratoAssinatura: { findMany: jest.Mock } };
    const svc = new ContratoAssinaturasService(
      prisma as unknown as never,
      { enqueueEvent: jest.fn() } as unknown as never,
    );
    await svc.list('c1');
    const where = prisma.contratoAssinatura.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ contratoId: 'c1' });
  });
});

describe('AUDIT.4 — comentarios.list aceita tenantId (defense in depth)', () => {
  it('quando opts.tenantId passado, filtra via contrato.tenantId', async () => {
    const prisma = makePrisma() as { contratoComentario: { findMany: jest.Mock } };
    const svc = new ContratoComentariosService(
      prisma as unknown as never,
      { enqueueEvent: jest.fn() } as unknown as never,
    );
    await svc.list('c1', { tenantId: 't1' });
    const where = prisma.contratoComentario.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      contratoId: 'c1',
      contrato: { tenantId: 't1', deletedAt: null },
    });
  });

  it('sem tenantId (rota pública /c/:token), filtra só por contratoId', async () => {
    const prisma = makePrisma() as { contratoComentario: { findMany: jest.Mock } };
    const svc = new ContratoComentariosService(
      prisma as unknown as never,
      { enqueueEvent: jest.fn() } as unknown as never,
    );
    await svc.list('c1');
    const where = prisma.contratoComentario.findMany.mock.calls[0][0].where;
    expect(where.contrato).toBeUndefined();
    expect(where.contratoId).toBe('c1');
  });
});
