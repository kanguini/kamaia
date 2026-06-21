import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  JwtPayload,
  Role,
  TenantContext,
  TerminacaoTipo,
} from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { ContratoTerminacaoService } from './terminacao.service';

const RegistarTerminacaoSchema = z.object({
  tipo: z.nativeEnum(TerminacaoTipo),
  dataEfectiva: z.coerce.date(),
  motivacao: z.string().max(5000).optional(),
  documentoId: z.string().uuid().optional(),
  obrigacoesPosTermo: z.record(z.string(), z.unknown()).optional(),
});

@Controller('contratos/:contratoId/terminacao')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoTerminacaoController {
  constructor(private readonly term: ContratoTerminacaoService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.term.get(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async registar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(RegistarTerminacaoSchema))
    dto: z.infer<typeof RegistarTerminacaoSchema>,
  ) {
    return this.term.registar(tenant.tenantId, user.sub, contratoId, dto);
  }
}
