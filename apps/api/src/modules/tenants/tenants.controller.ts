import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role, TenantContext, TenantPlan } from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import { TenantsService } from './tenants.service';

const UpdateTenantSchema = z.object({
  nome: z.string().min(2).max(200).optional(),
  nif: z.string().max(20).optional(),
  email: z.string().email().max(200).optional(),
  telefone: z.string().max(30).optional(),
  morada: z.record(z.string(), z.unknown()).optional(),
  logoUrl: z.string().url().max(500).optional(),
});
type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;

const CreateSubTenantSchema = z.object({
  nome: z.string().min(2).max(200),
  nif: z.string().max(20).optional(),
  plan: z.nativeEnum(TenantPlan).optional(),
});
type CreateSubTenantDto = z.infer<typeof CreateSubTenantSchema>;

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  /** Lista os tenants onde o user tem Membership. Não usa TenantGuard. */
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: JwtPayload) {
    return this.tenants.list(user.sub);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async current(@Tenant() tenant: TenantContext) {
    return this.tenants.get(tenant.tenantId);
  }

  @Patch('current')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateCurrent(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(UpdateTenantSchema)) dto: UpdateTenantDto,
  ) {
    return this.tenants.update(tenant.tenantId, user.sub, dto);
  }

  // ─── Sub-tenants (AGENCY mode) ───────────────────────────────────

  @Get('current/sub-tenants')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async listSubs(@Tenant() tenant: TenantContext) {
    return this.tenants.listSubTenants(tenant.tenantId);
  }

  @Post('current/sub-tenants')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createSub(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateSubTenantSchema)) dto: CreateSubTenantDto,
  ) {
    return this.tenants.createSubTenant(tenant.tenantId, user.sub, dto);
  }
}
