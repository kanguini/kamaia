import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  PLAN_LIMITS,
  TenantPlan,
  TenantStatus,
} from '@kamaia/shared-types';
import { TenantsService } from './tenants.service';

/**
 * Specs do TenantsService — invariantes desta auditoria:
 *  - createSubTenant respeita `subTenantsMax` do plano AGENCY
 *  - createSubTenant rejeita parents não-AGENCY
 *  - createSubTenant rejeita aninhamento (parent já é sub)
 *  - update rejeita updates a tenants CANCELLED
 *  - audit.log corre FORA do $transaction (não fica órfão se rollback)
 */

interface TenantRow {
  id: string;
  slug: string;
  nome: string;
  nif: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  parentTenantId: string | null;
  deletedAt: Date | null;
}

function makePrisma(tenants: TenantRow[], subCounts: Record<string, number>) {
  return {
    tenant: {
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return tenants.find((t) => t.id === args.where.id) ?? null;
      }),
      findUniqueOrThrow: jest.fn(async (args: { where: { id: string } }) => {
        const t = tenants.find((t) => t.id === args.where.id);
        if (!t) throw new Error('not found');
        return t;
      }),
      count: jest.fn(
        async (args: { where: { parentTenantId: string; deletedAt: null } }) => {
          return subCounts[args.where.parentTenantId] ?? 0;
        },
      ),
      updateMany: jest.fn(
        async (args: { where: { id: string; status: { not: TenantStatus } }; data: Partial<TenantRow> }) => {
          const t = tenants.find(
            (t) => t.id === args.where.id && t.status !== args.where.status.not,
          );
          if (!t) return { count: 0 };
          Object.assign(t, args.data);
          return { count: 1 };
        },
      ),
      create: jest.fn(async (args: { data: TenantRow }) => {
        tenants.push(args.data);
        return args.data;
      }),
    },
    membership: {
      create: jest.fn(async () => ({ ok: true })),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(null)),
  };
}

function makeSvc(tenants: TenantRow[], subCounts: Record<string, number> = {}) {
  const prisma = makePrisma(tenants, subCounts);
  const audit = { log: jest.fn(async () => undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new TenantsService(prisma as any, audit as any);
  // injecta o prisma como tx callback
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
  );
  return { svc, prisma, audit };
}

const agencyTenant = (over: Partial<TenantRow> = {}): TenantRow => ({
  id: 't-agency',
  slug: 'agency-1',
  nome: 'Agency Co',
  nif: null,
  plan: TenantPlan.AGENCY,
  status: TenantStatus.ACTIVE,
  parentTenantId: null,
  deletedAt: null,
  ...over,
});

describe('TenantsService.update', () => {
  it('rejeita update de tenant CANCELLED', async () => {
    const t = agencyTenant({ status: TenantStatus.CANCELLED });
    const { svc } = makeSvc([t]);
    await expect(svc.update(t.id, 'u-1', { nome: 'X' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('permite update de tenant ACTIVE', async () => {
    const t = agencyTenant();
    const { svc, audit } = makeSvc([t]);
    const r = await svc.update(t.id, 'u-1', { nome: 'Novo Nome' });
    expect(r.nome).toBe('Novo Nome');
    expect(audit.log).toHaveBeenCalled();
  });

  it('rejeita update inexistente', async () => {
    const { svc } = makeSvc([]);
    await expect(svc.update('t-fake', 'u-1', { nome: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('TenantsService.createSubTenant', () => {
  it('rejeita parent não-AGENCY', async () => {
    const t = agencyTenant({ plan: TenantPlan.STARTER });
    const { svc } = makeSvc([t]);
    await expect(
      svc.createSubTenant(t.id, 'u-1', { nome: 'Sub' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejeita aninhamento (parent já é sub)', async () => {
    const t = agencyTenant({ parentTenantId: 't-grand' });
    const { svc } = makeSvc([t]);
    await expect(
      svc.createSubTenant(t.id, 'u-1', { nome: 'Sub' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita parent inexistente', async () => {
    const { svc } = makeSvc([]);
    await expect(
      svc.createSubTenant('t-fake', 'u-1', { nome: 'Sub' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('respeita subTenantsMax do plano AGENCY', async () => {
    const t = agencyTenant();
    const max = PLAN_LIMITS[TenantPlan.AGENCY].subTenantsMax;
    // Saturado no limite
    const { svc } = makeSvc([t], { [t.id]: max });
    await expect(
      svc.createSubTenant(t.id, 'u-1', { nome: 'Sub' }),
    ).rejects.toThrow(/máximo/);
  });

  it('permite criar quando dentro do limite', async () => {
    const t = agencyTenant();
    const { svc, audit } = makeSvc([t], { [t.id]: 0 });
    const sub = await svc.createSubTenant(t.id, 'u-1', { nome: 'Sub' });
    expect(sub.parentTenantId).toBe(t.id);
    expect(sub.plan).toBe(TenantPlan.STARTER); // default
    expect(audit.log).toHaveBeenCalled();
  });

  it('slug com sufixo random (não timestamp)', async () => {
    const t = agencyTenant();
    const { svc } = makeSvc([t], { [t.id]: 0 });
    const sub1 = await svc.createSubTenant(t.id, 'u-1', { nome: 'Cliente Exemplo' });
    // O sufixo é 8 hex chars depois do slug normalizado
    expect(sub1.slug).toMatch(/^cliente-exemplo-[0-9a-f]{8}$/);
  });
});

describe('TenantsService.listSubTenants', () => {
  it('filtra deletedAt', async () => {
    const parent = agencyTenant();
    const subAlive = agencyTenant({
      id: 't-sub-1',
      parentTenantId: parent.id,
      plan: TenantPlan.STARTER,
    });
    const subDead = agencyTenant({
      id: 't-sub-2',
      parentTenantId: parent.id,
      plan: TenantPlan.STARTER,
      deletedAt: new Date(),
    });
    // Custom prisma mock — listSubTenants chama findMany
    const tenants = [parent, subAlive, subDead];
    const prisma = {
      tenant: {
        findMany: jest.fn(
          async (args: { where: { parentTenantId: string; deletedAt: null } }) => {
            return tenants.filter(
              (t) =>
                t.parentTenantId === args.where.parentTenantId &&
                t.deletedAt === null,
            );
          },
        ),
      },
    };
    const audit = { log: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new TenantsService(prisma as any, audit as any);
    const r = await svc.listSubTenants(parent.id);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('t-sub-1');
  });
});
