import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '@kamaia/shared-types';

/**
 * @Tenant() injecta o contexto do tenant activo no request, validado pelo
 * TenantGuard. Disponível em qualquer handler depois de JwtAuthGuard +
 * TenantGuard.
 */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);

/**
 * @TenantId() — atalho para o tenantId activo, igual em uso a `request.tenant.tenantId`.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant?.tenantId;
  },
);
