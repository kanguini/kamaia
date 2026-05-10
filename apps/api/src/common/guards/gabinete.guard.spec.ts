import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GabineteGuard } from './gabinete.guard';

// Mínimo necessário para satisfazer ExecutionContext — só usamos
// switchToHttp().getRequest() no guard.
function makeContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('GabineteGuard', () => {
  let guard: GabineteGuard;

  beforeEach(() => {
    guard = new GabineteGuard();
  });

  it('aceita pedido com user.gabineteId definido', () => {
    const ctx = makeContext({
      user: { sub: 'user-1', gabineteId: 'gab-1', role: 'ADVOGADO_SOLO' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejeita pedido sem user (JwtAuthGuard não correu antes)', () => {
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejeita pedido com user mas sem gabineteId', () => {
    const ctx = makeContext({ user: { sub: 'user-1' } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejeita pedido com gabineteId vazio (string falsy)', () => {
    const ctx = makeContext({ user: { sub: 'user-1', gabineteId: '' } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejeita pedido com gabineteId null', () => {
    const ctx = makeContext({ user: { sub: 'user-1', gabineteId: null } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
