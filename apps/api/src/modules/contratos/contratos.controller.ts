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
  CreateContratoDto,
  CreateContratoSchema,
  ListContratosQuery,
  ListContratosQuerySchema,
  TransicaoEstadoDto,
  TransicaoEstadoSchema,
  UpdateContratoDto,
  UpdateContratoSchema,
} from './contratos.dto';
import { ContratosService } from './contratos.service';

@Controller('contratos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratosController {
  constructor(private readonly contratos: ContratosService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query(new ParseZodPipe(ListContratosQuerySchema)) q: ListContratosQuery,
  ) {
    return this.contratos.list(tenant.tenantId, q);
  }

  @Get('dashboard')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async dashboard(@Tenant() tenant: TenantContext) {
    return this.contratos.dashboard(tenant.tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.contratos.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateContratoSchema)) dto: CreateContratoDto,
  ) {
    return this.contratos.create(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateContratoSchema)) dto: UpdateContratoDto,
  ) {
    return this.contratos.update(tenant.tenantId, user.sub, id, dto);
  }

  @Post(':id/transicao')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async transitar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(TransicaoEstadoSchema)) dto: TransicaoEstadoDto,
  ) {
    return this.contratos.transitar(tenant.tenantId, user.sub, id, dto.para, dto.motivo);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async delete(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.contratos.softDelete(tenant.tenantId, user.sub, id);
  }
}
