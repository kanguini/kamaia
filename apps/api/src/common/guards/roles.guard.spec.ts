import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KamaiaRole } from '@kamaia/shared-types';
import { RolesGuard } from './roles.guard';

function makeContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function reflectorWithRoles(roles: KamaiaRole[] | undefined): Reflector {
  return {
    getAllAndOverride: () => roles,
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('permite quando nenhum @Roles foi declarado', () => {
    const guard = new RolesGuard(reflectorWithRoles(undefined));
    const ctx = makeContext({ user: { role: KamaiaRole.ESTAGIARIO } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite quando @Roles está vazio', () => {
    const guard = new RolesGuard(reflectorWithRoles([]));
    const ctx = makeContext({ user: { role: KamaiaRole.ESTAGIARIO } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejeita pedido sem user mesmo quando há roles required', () => {
    const guard = new RolesGuard(
      reflectorWithRoles([KamaiaRole.ADVOGADO_SOLO]),
    );
    const ctx = makeContext({});
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('permite quando role do user está na lista required', () => {
    const guard = new RolesGuard(
      reflectorWithRoles([KamaiaRole.ADVOGADO_SOLO, KamaiaRole.ADVOGADO_MEMBRO]),
    );
    const ctx = makeContext({ user: { role: KamaiaRole.ADVOGADO_SOLO } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejeita quando role do user NÃO está na lista required', () => {
    const guard = new RolesGuard(
      reflectorWithRoles([KamaiaRole.SOCIO_GESTOR]),
    );
    const ctx = makeContext({ user: { role: KamaiaRole.ESTAGIARIO } });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('SOCIO_GESTOR bypassa qualquer @Roles (superadmin)', () => {
    const guard = new RolesGuard(
      reflectorWithRoles([KamaiaRole.ADVOGADO_MEMBRO]),
    );
    const ctx = makeContext({ user: { role: KamaiaRole.SOCIO_GESTOR } });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
