import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { CarteirasService } from './carteiras.service';

const CreateCarteiraSchema = z.object({
  nome: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateCarteiraDto = z.infer<typeof CreateCarteiraSchema>;

const UpdateCarteiraSchema = CreateCarteiraSchema.partial();
type UpdateCarteiraDto = z.infer<typeof UpdateCarteiraSchema>;

const MoverContratosSchema = z.object({
  targetCarteiraId: z.string().uuid().nullable(),
  contratoIds: z.array(z.string().uuid()).min(1).max(500),
});

@Controller('carteiras')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CarteirasController {
  constructor(private readonly carteiras: CarteirasService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(@Tenant() tenant: TenantContext) {
    return this.carteiras.list(tenant.tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.carteiras.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateCarteiraSchema)) dto: CreateCarteiraDto,
  ) {
    return this.carteiras.create(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateCarteiraSchema)) dto: UpdateCarteiraDto,
  ) {
    return this.carteiras.update(tenant.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async delete(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.carteiras.softDelete(tenant.tenantId, user.sub, id);
  }

  /**
   * Mover N contratos entre carteiras (ou desligar todos passando
   * targetCarteiraId=null). Substitui o loop manual de N PATCH.
   */
  @Post('mover-contratos')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async moverContratos(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(MoverContratosSchema))
    dto: z.infer<typeof MoverContratosSchema>,
  ) {
    return this.carteiras.moverContratos(
      tenant.tenantId,
      user.sub,
      dto.targetCarteiraId,
      dto.contratoIds,
    );
  }
}
