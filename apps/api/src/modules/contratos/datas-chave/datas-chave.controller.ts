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
import {
  DataChaveTipo,
  JwtPayload,
  Role,
  TenantContext,
} from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { ContratoDatasChaveService } from './datas-chave.service';

const AddDataChaveSchema = z.object({
  tipo: z.nativeEnum(DataChaveTipo),
  data: z.coerce.date(),
  descricao: z.string().max(2000).optional(),
  alertaDias: z.array(z.number().int().positive()).default([90, 30, 7]),
});
type AddDataChaveDto = z.infer<typeof AddDataChaveSchema>;

@Controller('contratos/:contratoId/datas-chave')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoDatasChaveController {
  constructor(private readonly datas: ContratoDatasChaveService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.datas.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async add(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(AddDataChaveSchema)) dto: AddDataChaveDto,
  ) {
    return this.datas.add(tenant.tenantId, user.sub, contratoId, dto);
  }

  @Patch(':id/cumprida')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async cumprir(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.datas.marcarCumprida(tenant.tenantId, user.sub, id);
  }
}
