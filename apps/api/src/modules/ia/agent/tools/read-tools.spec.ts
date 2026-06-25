/**
 * Smoke tests para as tools de leitura (Sprint 1.3).
 *
 * Foco: tenant isolation, RBAC, output format. Detalhes mais
 * profundos por tool individual ficam para quando aparecer um
 * bug específico que requeira regressão dedicada.
 */
import { Role } from '@prisma/client';
import { buildFindEntidadesTool } from './find-entidades.tool';
import { buildOpenContratoTool } from './open-contrato.tool';
import { buildListDatasChaveTool } from './list-datas-chave.tool';
import { buildListObrigacoesTool } from './list-obrigacoes.tool';
import { ToolContext } from '../tool.types';

const CTX_BASE: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  role: Role.ADMIN,
  conversationId: 'conv-1',
  messageId: 'msg-1',
};

describe('find_entidades', () => {
  it('injecta tenantId no WHERE', async () => {
    const prisma = {
      entidade: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as never;
    const tool = buildFindEntidadesTool(prisma);

    await tool.execute({ limit: 10 } as never, CTX_BASE);
    expect((prisma as never as { entidade: { findMany: jest.Mock } }).entidade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-A',
          deletedAt: null,
        }),
      }),
    );
  });

  it('formata uiPayload com items clicáveis', async () => {
    const prisma = {
      entidade: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e-1',
            nome: 'Hexa Segura',
            nomeComercial: null,
            tipo: 'PESSOA_COLECTIVA',
            nif: '5410000123',
            paisResidencia: 'AO',
            nacionalidadeCambial: 'RESIDENTE',
            isInstituicaoFinanceira: false,
            sectorActividade: 'Seguros',
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as never;
    const tool = buildFindEntidadesTool(prisma);
    const out = await tool.execute({ limit: 10 } as never, CTX_BASE);
    expect(out.renderHint).toBe('list');
    expect(out.uiPayload).toMatchObject({
      items: [{ href: '/entidades/e-1', label: 'Hexa Segura' }],
    });
  });

  it('excludes EXTERNAL role; inclui VIEWER', () => {
    const prisma = { entidade: { findMany: jest.fn(), count: jest.fn() } };
    const tool = buildFindEntidadesTool(prisma as never);
    expect(tool.requiredRoles).toContain(Role.VIEWER);
    expect(tool.requiredRoles).not.toContain(Role.EXTERNAL);
  });
});

describe('open_contrato', () => {
  it('falha quando nem contratoId nem numeroInterno são fornecidos', async () => {
    const prisma = {
      contrato: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never;
    const tool = buildOpenContratoTool(prisma);
    const out = await tool.execute({} as never, CTX_BASE);
    expect(out.isError).toBe(true);
  });

  it('aceita numeroInterno e devolve target URL', async () => {
    const prisma = {
      contrato: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ct-uuid',
          numeroInterno: 'CT-2026-00042',
          titulo: 'Contrato X',
          estado: 'ACTIVO',
          tipo: { nome: 'NDA' },
        }),
      },
    } as never;
    const tool = buildOpenContratoTool(prisma);
    const out = await tool.execute(
      { numeroInterno: 'CT-2026-00042' } as never,
      CTX_BASE,
    );
    expect(out.renderHint).toBe('navigate');
    expect((out.result as { target: string }).target).toBe('/contratos/ct-uuid');
  });

  it('isError quando contrato não existe', async () => {
    const prisma = {
      contrato: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never;
    const tool = buildOpenContratoTool(prisma);
    const out = await tool.execute(
      { contratoId: '11111111-1111-1111-1111-111111111111' } as never,
      CTX_BASE,
    );
    expect(out.isError).toBe(true);
  });

  it('respeita tenantId no findFirst', async () => {
    const prisma = {
      contrato: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never;
    const tool = buildOpenContratoTool(prisma);
    await tool.execute({ numeroInterno: 'CT-X' } as never, CTX_BASE);
    expect((prisma as never as { contrato: { findFirst: jest.Mock } }).contrato.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A' }),
      }),
    );
  });
});

describe('list_datas_chave', () => {
  it('aplica WHERE via relação contrato.tenantId', async () => {
    const prisma = {
      contratoDataChave: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as never;
    const tool = buildListDatasChaveTool(prisma);
    await tool.execute({ limit: 20 } as never, CTX_BASE);
    const call = (prisma as never as { contratoDataChave: { findMany: jest.Mock } }).contratoDataChave.findMany.mock.calls[0][0];
    expect(call.where.contrato).toEqual({
      tenantId: 'tenant-A',
      deletedAt: null,
    });
  });

  it('default exclui datas cumpridas', async () => {
    const prisma = {
      contratoDataChave: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as never;
    const tool = buildListDatasChaveTool(prisma);
    await tool.execute({ limit: 20 } as never, CTX_BASE);
    expect(
      (prisma as never as { contratoDataChave: { findMany: jest.Mock } }).contratoDataChave.findMany.mock.calls[0][0].where.cumprida,
    ).toBe(false);
  });

  it('calcula dias e marca atrasada quando data no passado', async () => {
    const passado = new Date();
    passado.setDate(passado.getDate() - 5);
    const prisma = {
      contratoDataChave: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'd-1',
            tipo: 'PAGAMENTO',
            data: passado,
            descricao: 'X',
            cumprida: false,
            contrato: {
              id: 'ct-1',
              numeroInterno: 'CT-2026-00001',
              titulo: 'X',
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as never;
    const tool = buildListDatasChaveTool(prisma);
    const out = await tool.execute({ limit: 20 } as never, CTX_BASE);
    const datas = (out.result as { datas: { atrasada: boolean; dias: number }[] }).datas;
    expect(datas[0].atrasada).toBe(true);
    expect(datas[0].dias).toBeLessThan(0);
  });
});

describe('list_obrigacoes', () => {
  it('aplica WHERE via relação contrato.tenantId', async () => {
    const prisma = {
      contratoObrigacao: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as never;
    const tool = buildListObrigacoesTool(prisma);
    await tool.execute({ limit: 20 } as never, CTX_BASE);
    const call = (prisma as never as { contratoObrigacao: { findMany: jest.Mock } }).contratoObrigacao.findMany.mock.calls[0][0];
    expect(call.where.contrato).toEqual({
      tenantId: 'tenant-A',
      deletedAt: null,
    });
  });

  it('default filtra apenas activas', async () => {
    const prisma = {
      contratoObrigacao: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as never;
    const tool = buildListObrigacoesTool(prisma);
    await tool.execute({ limit: 20 } as never, CTX_BASE);
    expect(
      (prisma as never as { contratoObrigacao: { findMany: jest.Mock } }).contratoObrigacao.findMany.mock.calls[0][0].where.isActive,
    ).toBe(true);
  });

  it('mapeia BigInt valorEsperado para string', async () => {
    const prisma = {
      contratoObrigacao: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'o-1',
            tipo: 'PAGAMENTO_PERIODICO',
            periodicidade: 'MENSAL',
            descricao: 'Renda mensal',
            proximaData: new Date('2026-08-01'),
            valorEsperado: 250_000n,
            moeda: 'AOA',
            contrato: {
              id: 'ct-1',
              numeroInterno: 'CT-2026-00001',
              titulo: 'Arrendamento',
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as never;
    const tool = buildListObrigacoesTool(prisma);
    const out = await tool.execute({ limit: 20 } as never, CTX_BASE);
    expect((out.result as { obrigacoes: { valor: string }[] }).obrigacoes[0].valor).toBe(
      '250000',
    );
  });
});
