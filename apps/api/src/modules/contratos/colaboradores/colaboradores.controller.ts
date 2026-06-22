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
  ColaboradorTipoAcesso,
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
import { ContratoColaboradoresService } from './colaboradores.service';

const CreateColaboradorSchema = z.object({
  email: z.string().email().max(200),
  nome: z.string().max(200).optional(),
  tipoAcesso: z.nativeEnum(ColaboradorTipoAcesso),
  ttlDias: z.number().int().min(1).max(365).optional(),
});

@Controller('contratos/:contratoId/colaboradores')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoColaboradoresController {
  constructor(private readonly colaboradores: ContratoColaboradoresService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.colaboradores.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(CreateColaboradorSchema))
    dto: z.infer<typeof CreateColaboradorSchema>,
  ) {
    return this.colaboradores.create(tenant.tenantId, user.sub, contratoId, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async revogar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.colaboradores.revogar(tenant.tenantId, user.sub, contratoId, id);
  }
}
