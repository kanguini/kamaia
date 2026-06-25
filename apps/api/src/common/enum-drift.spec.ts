/**
 * CI test que detecta drift entre os enums Prisma e os enums
 * partilhados em @kamaia/shared-types.
 *
 * Auditoria sinalizou: BillingService faz `tenant.plan as unknown as
 * TenantPlan` — se alguém adicionar `FREE` ao schema.prisma e
 * esquecer de actualizar shared-types, `PLANS[plan]` devolve
 * `undefined` e a UI rebenta.
 *
 * Este test corre o equivalente a um lint cross-source: garante
 * que cada enum partilhado tem exactamente os mesmos members em
 * ambos os lados.
 */

import { TenantPlan, ContratoEstado, Role } from '@prisma/client';
import {
  TenantPlan as SharedTenantPlan,
  ContratoEstado as SharedContratoEstado,
  Role as SharedRole,
} from '@kamaia/shared-types';

function sortedKeys(obj: Record<string, string>): string[] {
  return Object.keys(obj).sort();
}

describe('Enum drift entre Prisma client e shared-types', () => {
  it('TenantPlan: members idênticos', () => {
    expect(sortedKeys(TenantPlan as Record<string, string>)).toEqual(
      sortedKeys(SharedTenantPlan as unknown as Record<string, string>),
    );
  });

  it('ContratoEstado: members idênticos', () => {
    expect(sortedKeys(ContratoEstado as Record<string, string>)).toEqual(
      sortedKeys(SharedContratoEstado as unknown as Record<string, string>),
    );
  });

  it('Role: members idênticos', () => {
    expect(sortedKeys(Role as Record<string, string>)).toEqual(
      sortedKeys(SharedRole as unknown as Record<string, string>),
    );
  });
});
