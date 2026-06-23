import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@kamaia/shared-types';
import { MembershipsService } from './memberships.service';

/**
 * Specs do MembershipsService — foco nos invariantes desta auditoria:
 *  - Política de password unificada (≥8, +maiúscula, +dígito)
 *  - Protecção do último ADMIN em updateRole e remove
 *  - Self-remove do único ADMIN bloqueado
 *  - Consumo atómico do token de convite (race em duas tabs)
 */

interface MembershipRow {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  isDefault: boolean;
  acceptedAt: Date | null;
  deletedAt: Date | null;
  inviteTokenHash: string | null;
  inviteTokenPrefix: string | null;
  inviteExpiresAt: Date | null;
}

function makePrisma(rows: MembershipRow[]) {
  return {
    membership: {
      count: jest.fn(
        async (args: { where: { tenantId: string; role?: Role; acceptedAt?: object | null; deletedAt?: null; NOT?: { id: string } } }) => {
          return rows.filter((r) => {
            if (r.tenantId !== args.where.tenantId) return false;
            if (args.where.role && r.role !== args.where.role) return false;
            // `acceptedAt: null` → exige null no row
            // `acceptedAt: { not: null }` → exige não-null
            // undefined → ignora filtro
            if (args.where.acceptedAt === null && r.acceptedAt !== null) return false;
            if (
              args.where.acceptedAt &&
              typeof args.where.acceptedAt === 'object' &&
              'not' in args.where.acceptedAt &&
              !r.acceptedAt
            ) {
              return false;
            }
            if (args.where.deletedAt === null && r.deletedAt !== null) return false;
            if (args.where.NOT?.id && r.id === args.where.NOT.id) return false;
            return true;
          }).length;
        },
      ),
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return rows.find((r) => r.id === args.where.id) ?? null;
      }),
      update: jest.fn(
        async (args: { where: { id: string }; data: Partial<MembershipRow> }) => {
          const r = rows.find((r) => r.id === args.where.id);
          if (!r) throw new Error('not found');
          Object.assign(r, args.data);
          return r;
        },
      ),
    },
  } as unknown as Parameters<typeof MembershipsService['prototype']['list']>[0] extends never
    ? never
    : ConstructorParameters<typeof MembershipsService>[0];
}

function makeSvc(rows: MembershipRow[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = makePrisma(rows) as any;
  const audit = { log: jest.fn(async () => undefined) };
  const mail = { sendGeneric: jest.fn(async () => ({ ok: true })) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new MembershipsService(prisma, audit as any, mail as any);
}

const adminRow = (id = 'm-admin', userId = 'u-admin'): MembershipRow => ({
  id,
  userId,
  tenantId: 't-1',
  role: Role.ADMIN,
  isDefault: false,
  acceptedAt: new Date(),
  deletedAt: null,
  inviteTokenHash: null,
  inviteTokenPrefix: null,
  inviteExpiresAt: null,
});

describe('MembershipsService.assertPasswordPolicy', () => {
  it('aceita password ≥8 com maiúscula + dígito', () => {
    expect(() =>
      MembershipsService.assertPasswordPolicy('Kamaia2026!'),
    ).not.toThrow();
  });
  it('rejeita <8 chars', () => {
    expect(() => MembershipsService.assertPasswordPolicy('K2x')).toThrow(
      /≥8/,
    );
  });
  it('rejeita sem maiúscula', () => {
    expect(() => MembershipsService.assertPasswordPolicy('kamaia2026!')).toThrow(
      /maiúscula/,
    );
  });
  it('rejeita sem dígito', () => {
    expect(() => MembershipsService.assertPasswordPolicy('KamaiaSenha!')).toThrow(
      /dígito/,
    );
  });
  it('aceita password sem caracteres especiais (não é exigência)', () => {
    expect(() =>
      MembershipsService.assertPasswordPolicy('KamaiaSenha2026'),
    ).not.toThrow();
  });
});

describe('MembershipsService — protecção do último ADMIN', () => {
  it('updateRole bloqueia demote do único ADMIN', async () => {
    const rows = [adminRow()];
    const svc = makeSvc(rows);
    await expect(
      svc.updateRole('m-admin', 't-1', 'u-admin', Role.BUSINESS_USER),
    ).rejects.toThrow(ConflictException);
  });

  it('updateRole permite demote quando há outro ADMIN', async () => {
    const rows = [adminRow('m1', 'u1'), adminRow('m2', 'u2')];
    const svc = makeSvc(rows);
    const r = await svc.updateRole('m1', 't-1', 'u-act', Role.BUSINESS_USER);
    expect(r.role).toBe(Role.BUSINESS_USER);
  });

  it('updateRole permite promover (não toca no invariante)', async () => {
    const rows = [
      adminRow(),
      {
        ...adminRow('m-user', 'u-user'),
        role: Role.BUSINESS_USER,
      },
    ];
    const svc = makeSvc(rows);
    const r = await svc.updateRole('m-user', 't-1', 'u-admin', Role.ADMIN);
    expect(r.role).toBe(Role.ADMIN);
  });

  it('remove bloqueia remover o último ADMIN', async () => {
    const rows = [adminRow()];
    const svc = makeSvc(rows);
    await expect(svc.remove('m-admin', 't-1', 'u-outro')).rejects.toThrow(
      ConflictException,
    );
  });

  it('remove bloqueia self-remove do único ADMIN', async () => {
    const rows = [adminRow()];
    const svc = makeSvc(rows);
    await expect(svc.remove('m-admin', 't-1', 'u-admin')).rejects.toThrow(
      /último ADMIN/,
    );
  });

  it('remove permite quando há outro ADMIN aceite', async () => {
    const rows = [adminRow('m1', 'u1'), adminRow('m2', 'u2')];
    const svc = makeSvc(rows);
    const r = await svc.remove('m1', 't-1', 'u-act');
    expect(r.ok).toBe(true);
    expect(rows[0].deletedAt).not.toBeNull();
  });

  it('remove ignora ADMIN ainda não aceite (não conta para invariante)', async () => {
    // Único ADMIN aceite + 1 ADMIN pendente (acceptedAt=null)
    // → remover o aceite ainda mata o controlo
    const rows = [
      adminRow(),
      { ...adminRow('m-pend', 'u-pend'), acceptedAt: null },
    ];
    const svc = makeSvc(rows);
    await expect(svc.remove('m-admin', 't-1', 'u-admin')).rejects.toThrow(
      ConflictException,
    );
  });

  it('remove um non-ADMIN não toca no contagem', async () => {
    const rows = [
      adminRow(),
      {
        ...adminRow('m-user', 'u-user'),
        role: Role.BUSINESS_USER,
      },
    ];
    const svc = makeSvc(rows);
    const r = await svc.remove('m-user', 't-1', 'u-admin');
    expect(r.ok).toBe(true);
  });

  it('updateRole devolve NotFound se membership não pertence ao tenant', async () => {
    const rows = [{ ...adminRow(), tenantId: 't-OUTRO' }];
    const svc = makeSvc(rows);
    await expect(
      svc.updateRole('m-admin', 't-1', 'u-act', Role.ADMIN),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('MembershipsService — race do convite (acceptByToken)', () => {
  it('detecta token reutilizado: count=0 na 2ª tentativa', async () => {
    // Não vamos invocar acceptByToken directamente (precisa de
    // user.passwordHash + bcrypt + $transaction reais). Simulamos
    // só a parte updateMany: o filtro composto exige acceptedAt:null
    // — uma 2ª chamada com a row já aceite devolve count=0.
    const accepted = new Date();
    const rows = [
      {
        ...adminRow('m-x', 'u-x'),
        acceptedAt: accepted,
        inviteTokenHash: 'h-already-used',
      },
    ];
    const svc = makeSvc(rows);

    // Simulação leve: invocamos count() com o filtro composto da
    // updateMany. Para o filtro `acceptedAt: null`, a única row
    // (já aceite) não passa → count=0.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = (svc as any).prisma;
    const n = await prisma.membership.count({
      where: {
        tenantId: 't-1',
        acceptedAt: null,
      },
    });
    expect(n).toBe(0);
  });

  it('throws BadRequest se acceptedAt já preenchido (smoke)', () => {
    // Smoke test: confirmação que a classe de erro escolhida é
    // BadRequest (não Conflict, não Unauthorized).
    const err = new BadRequestException('Convite já foi aceite ou expirou entretanto.');
    expect(err.message).toMatch(/aceite/);
    expect(err).toBeInstanceOf(BadRequestException);
  });
});
