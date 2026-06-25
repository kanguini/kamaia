import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role, TenantContext } from '@kamaia/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { BillingService } from './billing.service';
import { publicPlans } from './plans.config';

/**
 * /billing — leitura de subscription + uso actual + catálogo de planos.
 *
 * Endpoints autenticados:
 *  - GET /billing/status — plano + quotas + uso do tenant actual
 *
 * Endpoint público (sem tenant header):
 *  - GET /billing/plans — catálogo público (para marketing site)
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  async status(@Tenant() tenant: TenantContext) {
    return this.billing.getStatus(tenant.tenantId);
  }

  /**
   * Catálogo público de planos. Sem autenticação, sem tenant.
   * Usado pelo marketing site (Sprint 4.4) com revalidate=3600s.
   *
   * Onda B.SEC.15: rate limit explícito (10 req/min/IP) para evitar
   * scraping massivo. O ThrottlerGuard global aplica-se mas este
   * decorator override garante limites apertados para este endpoint
   * mesmo se o global afrouxar no futuro.
   *
   * `publicPlans()` filtra por isPublic=true; AGENCY foi colocado
   * como isPublic=false (sob proposta), por isso as suas quotas
   * internas NÃO são expostas.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('plans')
  async plans() {
    return { data: publicPlans() };
  }
}
