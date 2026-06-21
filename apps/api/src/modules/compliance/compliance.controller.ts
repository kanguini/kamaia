import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { ComplianceService } from './compliance.service';
import { ComplianceEngine } from './engine/compliance.engine';

const MarcarConcluidoSchema = z.object({
  comprovativoId: z.string().uuid().optional(),
  observacoes: z.string().max(2000).optional(),
  custoEmAKZ: z.coerce.bigint().optional(),
});

@Controller('compliance')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ComplianceController {
  constructor(
    private readonly service: ComplianceService,
    private readonly engine: ComplianceEngine,
  ) {}

  /** Lista todas as regras do engine — para transparência ao utilizador. */
  @Get('regras')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async listarRegras() {
    return this.engine.listAllRules();
  }

  /** Pendentes a vencer nos próximos N dias. */
  @Get('pendentes')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async pendentes(
    @Tenant() tenant: TenantContext,
    @Query('dias') dias?: string,
  ) {
    return this.service.listarPendentes(
      tenant.tenantId,
      dias ? parseInt(dias, 10) : 30,
    );
  }

  /** Força re-avaliação das regras para um contrato. */
  @Post('contratos/:contratoId/avaliar')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async avaliar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.service.avaliarContrato(contratoId, tenant.tenantId, user.sub);
  }

  /** Marca acto como concluído (utilizador confirma). */
  @Patch('actos/:actoId/concluir')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async concluir(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('actoId', new ParseUUIDPipe()) actoId: string,
    @Body(new ParseZodPipe(MarcarConcluidoSchema))
    dto: z.infer<typeof MarcarConcluidoSchema>,
  ) {
    return this.service.marcarConcluido(actoId, tenant.tenantId, user.sub, dto);
  }
}
