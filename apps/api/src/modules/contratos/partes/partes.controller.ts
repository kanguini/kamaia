import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  JwtPayload,
  PartePapel,
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
import { ContratoPartesService } from './partes.service';

const AddParteSchema = z.object({
  entidadeId: z.string().uuid(),
  papel: z.nativeEnum(PartePapel),
  representanteNome: z.string().max(200).optional(),
  representanteCargo: z.string().max(100).optional(),
  representanteBI: z.string().max(30).optional(),
});
type AddParteDto = z.infer<typeof AddParteSchema>;

@Controller('contratos/:contratoId/partes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoPartesController {
  constructor(private readonly partes: ContratoPartesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.partes.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async add(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(AddParteSchema)) dto: AddParteDto,
  ) {
    return this.partes.add(tenant.tenantId, user.sub, contratoId, dto);
  }

  @Delete(':parteId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async remove(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('parteId', new ParseUUIDPipe()) parteId: string,
  ) {
    return this.partes.remove(tenant.tenantId, user.sub, contratoId, parteId);
  }
}
