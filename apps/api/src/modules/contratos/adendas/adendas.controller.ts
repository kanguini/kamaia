import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload, MOEDAS_SUPORTADAS, Role, TenantContext } from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { ContratoAdendasService } from './adendas.service';

const CriarAdendaSchema = z.object({
  titulo: z.string().min(2).max(300),
  descricao: z.string().max(5000).optional(),
  herdarPartes: z.boolean().default(true),
  valor: z.coerce.bigint().refine((v) => v >= 0n, 'Valor não pode ser negativo').optional(),
  moeda: z.enum(MOEDAS_SUPORTADAS).optional(),
  dataTermo: z.coerce.date().optional(),
});

@Controller('contratos/:contratoId/adendas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoAdendasController {
  constructor(private readonly adendas: ContratoAdendasService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.adendas.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async criar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(CriarAdendaSchema))
    dto: z.infer<typeof CriarAdendaSchema>,
  ) {
    return this.adendas.criar(tenant.tenantId, user.sub, contratoId, dto);
  }
}
