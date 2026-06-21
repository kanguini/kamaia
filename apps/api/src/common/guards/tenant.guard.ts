import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

/**
 * TenantGuard — valida que o user autenticado tem Membership activa no
 * tenant identificado pelo header `X-Tenant-Id`. Anexa `request.tenant`
 * com {tenantId, role, parentTenantId, plan} para uso downstream.
 *
 * Deve correr depois do JwtAuthGuard (que popula `request.user`).
 *
 * Para tenants AGENCY: um user pode aceder ao tenant-pai E aos sub-tenants
 * se tiver Membership em qualquer um deles. Acesso a sub-tenant através
 * de Membership directa OU herança do tenant-pai (role=ADMIN no AGENCY).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const tenantId =
      (request.headers['x-tenant-id'] as string) ||
      (request.headers['X-Tenant-Id'] as string);

    if (!tenantId) {
      throw new ForbiddenException('X-Tenant-Id header is required');
    }

    // Membership directa
    const direct = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.sub, tenantId } },
      include: { tenant: true },
    });

    if (direct && direct.acceptedAt) {
      request.tenant = {
        tenantId: direct.tenantId,
        role: direct.role,
        parentTenantId: direct.tenant.parentTenantId,
        plan: direct.tenant.plan,
      };
      return true;
    }

    // Herança via tenant-pai (AGENCY)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { parentTenantId: true, plan: true },
    });

    if (tenant?.parentTenantId) {
      const parentMembership = await this.prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: user.sub,
            tenantId: tenant.parentTenantId,
          },
        },
      });

      if (parentMembership && parentMembership.acceptedAt) {
        request.tenant = {
          tenantId,
          role: parentMembership.role,
          parentTenantId: tenant.parentTenantId,
          plan: tenant.plan,
          viaParent: true,
        };
        return true;
      }
    }

    throw new ForbiddenException('No membership in target tenant');
  }
}
