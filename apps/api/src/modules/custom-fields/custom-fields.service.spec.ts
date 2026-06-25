import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomFieldType, Prisma } from '@prisma/client';
import { CustomFieldsService } from './custom-fields.service';

/**
 * Tests do CustomFieldsService.
 *
 * Foco: tenant isolation, validação por tipo, RBAC implícito via
 * tenant check, audit log presence. Mocks do Prisma e Audit.
 */

interface MockAudit {
  log: jest.Mock;
  calls: unknown[];
}
function makeAudit(): MockAudit {
  const calls: unknown[] = [];
  return {
    log: jest.fn(async (e: unknown) => {
      calls.push(e);
    }),
    calls,
  };
}

interface MockPrisma {
  tipoContrato: { findUnique: jest.Mock };
  customFieldDefinition: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  contrato: { findFirst: jest.Mock };
  contratoCustomFieldValue: {
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
}
function makePrisma(overrides: Partial<MockPrisma> = {}): MockPrisma {
  return {
    tipoContrato: { findUnique: jest.fn() },
    customFieldDefinition: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contrato: { findFirst: jest.fn() },
    contratoCustomFieldValue: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
}

const TENANT = 'tenant-A';
const USER = 'user-1';

describe('CustomFieldsService — tenant isolation', () => {
  it('listByTipo lança 404 quando tipo é doutro tenant', async () => {
    const audit = makeAudit();
    const prisma = makePrisma({
      tipoContrato: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tipo-1',
          tenantId: 'tenant-OUTRO',
          codigo: 'X',
          nome: 'X',
        }),
      },
    });
    const svc = new CustomFieldsService(prisma as never, audit as never);
    await expect(svc.listByTipo('tipo-1', TENANT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejeita custom fields em tipos do catálogo global', async () => {
    const audit = makeAudit();
    const prisma = makePrisma({
      tipoContrato: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tipo-global',
          tenantId: null,
          codigo: 'NDA',
          nome: 'NDA',
        }),
      },
    });
    const svc = new CustomFieldsService(prisma as never, audit as never);
    await expect(svc.listByTipo('tipo-global', TENANT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('aceita quando tipo pertence ao tenant', async () => {
    const audit = makeAudit();
    const prisma = makePrisma({
      tipoContrato: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tipo-1',
          tenantId: TENANT,
          codigo: 'NDA',
          nome: 'NDA',
        }),
      },
    });
    const svc = new CustomFieldsService(prisma as never, audit as never);
    const result = await svc.listByTipo('tipo-1', TENANT);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('CustomFieldsService — create', () => {
  function makeServiceWithTipo() {
    const audit = makeAudit();
    const prisma = makePrisma({
      tipoContrato: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tipo-1',
          tenantId: TENANT,
          codigo: 'CL',
          nome: 'Commercial Lease',
        }),
      },
    });
    return { svc: new CustomFieldsService(prisma as never, audit as never), prisma, audit };
  }

  it('cria definition e regista audit', async () => {
    const { svc, prisma, audit } = makeServiceWithTipo();
    (prisma.customFieldDefinition.create as jest.Mock).mockResolvedValue({
      id: 'def-1',
      key: 'areaM2',
    });

    const created = await svc.create('tipo-1', TENANT, USER, {
      key: 'areaM2',
      label: 'Área (m²)',
      type: CustomFieldType.NUMBER,
    } as never);

    expect(created.id).toBe('def-1');
    expect(audit.log).toHaveBeenCalled();
  });

  it('rejeita SELECT sem options', async () => {
    const { svc } = makeServiceWithTipo();
    await expect(
      svc.create('tipo-1', TENANT, USER, {
        key: 'estado',
        label: 'Estado',
        type: CustomFieldType.SELECT,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aceita SELECT com array de options', async () => {
    const { svc, prisma } = makeServiceWithTipo();
    (prisma.customFieldDefinition.create as jest.Mock).mockResolvedValue({
      id: 'def-2',
      key: 'estado',
    });
    const created = await svc.create('tipo-1', TENANT, USER, {
      key: 'estado',
      label: 'Estado',
      type: CustomFieldType.SELECT,
      options: ['Vivenda', 'Apartamento'],
    } as never);
    expect(created.id).toBe('def-2');
  });

  it('converte erro P2002 (duplicate key) em ConflictException', async () => {
    const { svc, prisma } = makeServiceWithTipo();
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
    });
    (prisma.customFieldDefinition.create as jest.Mock).mockRejectedValue(p2002);
    await expect(
      svc.create('tipo-1', TENANT, USER, {
        key: 'areaM2',
        label: 'X',
        type: CustomFieldType.NUMBER,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CustomFieldsService — update', () => {
  it('rejeita mudança de type', async () => {
    const audit = makeAudit();
    const prisma = makePrisma({
      customFieldDefinition: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'def-1',
          type: CustomFieldType.STRING,
          tipoContrato: { tenantId: TENANT },
          tipoContratoId: 'tipo-1',
          deletedAt: null,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const svc = new CustomFieldsService(prisma as never, audit as never);
    await expect(
      svc.update('def-1', TENANT, USER, {
        type: CustomFieldType.NUMBER,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CustomFieldsService — upsertValores', () => {
  function makeServiceWithDefs() {
    const audit = makeAudit();
    const definitions = [
      {
        id: 'def-area',
        key: 'areaM2',
        type: CustomFieldType.NUMBER,
        options: null,
      },
      {
        id: 'def-tipo',
        key: 'tipoImovel',
        type: CustomFieldType.SELECT,
        options: ['Vivenda', 'Apartamento'],
      },
      {
        id: 'def-data',
        key: 'inicioOcupacao',
        type: CustomFieldType.DATE,
        options: null,
      },
    ];
    const prisma = makePrisma({
      contrato: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'ct-1', tipoId: 'tipo-1' }),
      },
      customFieldDefinition: {
        findMany: jest.fn().mockResolvedValue(definitions),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    return {
      svc: new CustomFieldsService(prisma as never, audit as never),
      prisma,
    };
  }

  it('rejeita quando key inexistente', async () => {
    const { svc } = makeServiceWithDefs();
    await expect(
      svc.upsertValores('ct-1', TENANT, USER, {
        values: { naoExiste: 'x' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejeita valor NUMBER que não é número', async () => {
    const { svc } = makeServiceWithDefs();
    await expect(
      svc.upsertValores('ct-1', TENANT, USER, {
        values: { areaM2: 'cento e vinte' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejeita SELECT fora das options', async () => {
    const { svc } = makeServiceWithDefs();
    await expect(
      svc.upsertValores('ct-1', TENANT, USER, {
        values: { tipoImovel: 'Castelo' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejeita DATE em formato errado', async () => {
    const { svc } = makeServiceWithDefs();
    await expect(
      svc.upsertValores('ct-1', TENANT, USER, {
        values: { inicioOcupacao: '01/06/2026' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aceita valores válidos e chama upsert por cada', async () => {
    const { svc, prisma } = makeServiceWithDefs();
    await svc.upsertValores('ct-1', TENANT, USER, {
      values: {
        areaM2: 120,
        tipoImovel: 'Apartamento',
        inicioOcupacao: '2026-08-01',
      },
    });
    expect(prisma.contratoCustomFieldValue.upsert).toHaveBeenCalledTimes(3);
  });

  it('rejeita contrato doutro tenant (não encontra)', async () => {
    const audit = makeAudit();
    const prisma = makePrisma({
      contrato: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new CustomFieldsService(prisma as never, audit as never);
    await expect(
      svc.upsertValores('ct-1', TENANT, USER, { values: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
