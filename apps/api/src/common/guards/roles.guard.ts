import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@kamaia/shared-types';

/**
 * RolesGuard — valida que o user tem o role exigido pelo handler.
 * ADMIN bypasses todos os checks dentro do tenant.
 * Deve correr depois do TenantGuard, que popula `request.tenant.role`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant?.role) {
      return false;
    }

    if (tenant.role === Role.ADMIN) {
      return true;
    }

    return requiredRoles.includes(tenant.role);
  }
}
