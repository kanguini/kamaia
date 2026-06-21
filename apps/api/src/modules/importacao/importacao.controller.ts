import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  AddLinhaDto,
  AddLinhaSchema,
  CreateLoteDto,
  CreateLoteSchema,
  ListLotesQuery,
  ListLotesQuerySchema,
} from './importacao.dto';
import { ImportacaoService } from './importacao.service';

@Controller('importacao')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ImportacaoController {
  constructor(private readonly importacao: ImportacaoService) {}

  @Get('lotes')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query(new ParseZodPipe(ListLotesQuerySchema)) q: ListLotesQuery,
  ) {
    return this.importacao.list(tenant.tenantId, q);
  }

  @Get('lotes/:id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.importacao.get(tenant.tenantId, id);
  }

  @Post('lotes')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateLoteSchema)) dto: CreateLoteDto,
  ) {
    return this.importacao.createLote(tenant.tenantId, user.sub, dto);
  }

  @Post('lotes/:id/linhas')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async addLinha(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(AddLinhaSchema)) dto: AddLinhaDto,
  ) {
    return this.importacao.addLinha(tenant.tenantId, id, dto);
  }

  @Post('lotes/:id/start')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async start(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.importacao.start(tenant.tenantId, user.sub, id);
  }
}
