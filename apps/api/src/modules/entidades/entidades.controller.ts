import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  CreateEntidadeDto,
  CreateEntidadeSchema,
  ListEntidadesQuery,
  ListEntidadesQuerySchema,
  UpdateEntidadeDto,
  UpdateEntidadeSchema,
} from './entidades.dto';
import { EntidadesService } from './entidades.service';

@Controller('entidades')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EntidadesController {
  constructor(private readonly entidades: EntidadesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query(new ParseZodPipe(ListEntidadesQuerySchema)) q: ListEntidadesQuery,
  ) {
    return this.entidades.list(tenant.tenantId, q);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.entidades.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateEntidadeSchema)) dto: CreateEntidadeDto,
  ) {
    return this.entidades.create(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateEntidadeSchema)) dto: UpdateEntidadeDto,
  ) {
    return this.entidades.update(tenant.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async delete(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.entidades.softDelete(tenant.tenantId, user.sub, id);
  }
}
