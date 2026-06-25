/**
 * Tests das tools que mutam estado (Sprint 1.4).
 * Foco em path-happy + edge cases críticos (ambiguidade, tenant
 * isolation, compliance trigger).
 */
import { ContratoEstado, Role } from '@prisma/client';
import { buildCreateContratoTool } from './create-contrato.tool';
import { buildFindOrCreateEntidadeTool } from './find-or-create-entidade.tool';
import { ToolContext } from '../tool.types';

const CTX_CREATOR: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  role: Role.CONTRACT_MANAGER,
  conversationId: 'conv-1',
  messageId: 'msg-1',
};

describe('find_or_create_entidade', () => {
  it('devolve status=found quando há 1 match', async () => {
    const prisma = {
      entidade: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'e-1', nome: 'Hexa Seguros', nif: '54100' }]),
      },
    } as never;
    const entSvc = { create: jest.fn() } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    const out = await tool.execute({ query: 'Hexa' } as never, CTX_CREATOR);
    expect((out.result as { status: string }).status).toBe('found');
  });

  it('devolve status=ambiguous quando vários matches sem exacto', async () => {
    const prisma = {
      entidade: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'e-1', nome: 'Hexa Seguros', nif: null },
          { id: 'e-2', nome: 'Hexa Industrial', nif: null },
        ]),
      },
    } as never;
    const entSvc = { create: jest.fn() } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    const out = await tool.execute({ query: 'Hexa' } as never, CTX_CREATOR);
    expect((out.result as { status: string }).status).toBe('ambiguous');
  });

  it('resolve ambiguidade quando há match exacto por nome', async () => {
    const prisma = {
      entidade: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'e-1', nome: 'Hexa', nif: null },
          { id: 'e-2', nome: 'Hexa Industrial', nif: null },
        ]),
      },
    } as never;
    const entSvc = { create: jest.fn() } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    const out = await tool.execute({ query: 'Hexa' } as never, CTX_CREATOR);
    const r = out.result as { status: string; entidadeId?: string };
    expect(r.status).toBe('found');
    expect(r.entidadeId).toBe('e-1');
  });

  it('not_found sem criar quando createIfMissing=false (default)', async () => {
    const prisma = {
      entidade: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const entSvc = { create: jest.fn() } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    const out = await tool.execute({ query: 'Inexistente' } as never, CTX_CREATOR);
    expect((out.result as { status: string }).status).toBe('not_found');
    expect((entSvc as never as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('cria quando createIfMissing=true e não encontra', async () => {
    // Onda B.RACE.5: mock $transaction agora porque create stub é
    // serializado dentro de transaction com advisory lock.
    const prisma = {
      entidade: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(1),
          entidade: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (cb as any)(tx);
      }),
    } as never;
    const entSvc = {
      create: jest.fn().mockResolvedValue({ id: 'new-id', nome: 'Nova Empresa' }),
    } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    const out = await tool.execute(
      { query: 'Nova Empresa', createIfMissing: true } as never,
      CTX_CREATOR,
    );
    expect((out.result as { status: string }).status).toBe('created');
    expect((entSvc as never as { create: jest.Mock }).create).toHaveBeenCalledWith(
      'tenant-A',
      'user-1',
      expect.objectContaining({ nome: 'Nova Empresa' }),
    );
  });

  it('mutates=true (audit log activado)', () => {
    const prisma = { entidade: { findMany: jest.fn() } } as never;
    const entSvc = { create: jest.fn() } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    expect(tool.mutates).toBe(true);
  });

  it('apenas roles privilegiadas (não VIEWER nem BUSINESS_USER)', () => {
    const prisma = { entidade: { findMany: jest.fn() } } as never;
    const entSvc = { create: jest.fn() } as never;
    const tool = buildFindOrCreateEntidadeTool(prisma, entSvc);
    expect(tool.requiredRoles).toContain(Role.CONTRACT_MANAGER);
    expect(tool.requiredRoles).not.toContain(Role.VIEWER);
    expect(tool.requiredRoles).not.toContain(Role.BUSINESS_USER);
  });
});

describe('create_contrato', () => {
  function makeMocks(opts: {
    tipos?: Array<{ id: string; codigo: string; nome: string }>;
    entidades?: Array<{ id: string; nome: string }>;
    actos?: Array<{ tipo: string; observacoes: string | null }>;
  } = {}) {
    const tipos = opts.tipos ?? [
      { id: 'tipo-1', codigo: 'CTR_AGENCIA', nome: 'Contrato de Agência' },
    ];
    const entidades = opts.entidades ?? [];
    const actos = opts.actos ?? [];

    const prisma = {
      tipoContrato: {
        findFirst: jest.fn(async ({ where }: { where: { codigo?: { equals?: string } } }) => {
          if (where.codigo?.equals)
            return (
              tipos.find(
                (t) => t.codigo.toLowerCase() === where.codigo!.equals!.toLowerCase(),
              ) ?? null
            );
          return tipos[0] ?? null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      entidade: {
        findMany: jest.fn().mockResolvedValue(entidades),
        // Onda B.SEC.2: tool valida contraparteId via findFirst
        // antes de chegar a ContratosService. Mock devolve o id
        // mock para passar a validação.
        findFirst: jest.fn(async (args: { where: { id?: string } }) =>
          args.where.id ? { id: args.where.id } : null,
        ),
      },
      contratoActoRegulatorio: {
        findMany: jest.fn().mockResolvedValue(actos),
      },
    } as never;

    const contratosSvc = {
      create: jest.fn().mockResolvedValue({
        id: 'ct-new',
        numeroInterno: 'CT-2026-00042',
        titulo: 'Teste',
        estado: ContratoEstado.DRAFTING,
      }),
    } as never;

    const complianceSvc = { avaliarContrato: jest.fn() } as never;
    const customFieldsSvc = { upsertValores: jest.fn() } as never;
    return {
      prisma,
      contratosSvc,
      complianceSvc,
      customFieldsSvc,
      contratosSpy: (contratosSvc as never as { create: jest.Mock }).create,
    };
  }

  it('falha com isError quando tipo não existe', async () => {
    const m = makeMocks({ tipos: [] });
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    const out = await tool.execute(
      { titulo: 'X', tipoCodigo: 'NAO_EXISTE' } as never,
      CTX_CREATOR,
    );
    expect(out.isError).toBe(true);
  });

  it('cria com sucesso quando args bem formados; dispara compliance', async () => {
    const m = makeMocks({
      actos: [
        { tipo: 'IMPOSTO_DE_SELO', observacoes: 'TGIS Verba 23 — 0,5%' },
      ],
    });
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    const out = await tool.execute(
      {
        titulo: 'Contrato teste',
        tipoCodigo: 'CTR_AGENCIA',
        valor: 1_000_000,
        moeda: 'AOA',
      } as never,
      CTX_CREATOR,
    );
    const r = out.result as { status: string; compliance: { actosDetectados: number } };
    expect(r.status).toBe('created');
    expect(r.compliance.actosDetectados).toBe(1);
    expect((m.complianceSvc as never as { avaliarContrato: jest.Mock }).avaliarContrato).toHaveBeenCalled();
  });

  it('cria sem partes quando contraparteNome devolve 0', async () => {
    const m = makeMocks({ entidades: [] });
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    const out = await tool.execute(
      {
        titulo: 'X',
        tipoCodigo: 'CTR_AGENCIA',
        contraparteNome: 'Inexistente',
      } as never,
      CTX_CREATOR,
    );
    expect(out.isError).toBe(true);
    const r = out.result as { reason: string };
    expect(r.reason).toContain('Não encontrei contraparte');
  });

  it('cria com parte quando contraparteId fornecido directamente', async () => {
    const m = makeMocks();
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    await tool.execute(
      {
        titulo: 'X',
        tipoCodigo: 'CTR_AGENCIA',
        contraparteId: '11111111-1111-1111-1111-111111111111',
      } as never,
      CTX_CREATOR,
    );
    const callDto = m.contratosSpy.mock.calls[0][2];
    expect(callDto.partes).toHaveLength(1);
    expect(callDto.partes[0].entidadeId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('valor em unidades de moeda → BigInt centavos', async () => {
    const m = makeMocks();
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    await tool.execute(
      {
        titulo: 'X',
        tipoCodigo: 'CTR_AGENCIA',
        valor: 250_000,
      } as never,
      CTX_CREATOR,
    );
    const callDto = m.contratosSpy.mock.calls[0][2];
    expect(callDto.valor).toBe(BigInt(25_000_000)); // 250k * 100 centavos
  });

  it('contraparteNome ambíguo → isError com candidates', async () => {
    const m = makeMocks({
      entidades: [
        { id: 'e-1', nome: 'Hexa Seguros' },
        { id: 'e-2', nome: 'Hexa Industrial' },
      ],
    });
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    const out = await tool.execute(
      {
        titulo: 'X',
        tipoCodigo: 'CTR_AGENCIA',
        contraparteNome: 'Hexa',
      } as never,
      CTX_CREATOR,
    );
    expect(out.isError).toBe(true);
  });

  it('mutates=true e RBAC restrito', () => {
    const m = makeMocks();
    const tool = buildCreateContratoTool(m.prisma, m.contratosSvc, m.complianceSvc, m.customFieldsSvc);
    expect(tool.mutates).toBe(true);
    expect(tool.requiredRoles).toContain(Role.CONTRACT_MANAGER);
    expect(tool.requiredRoles).not.toContain(Role.VIEWER);
    expect(tool.requiredRoles).not.toContain(Role.BUSINESS_USER);
  });
});
