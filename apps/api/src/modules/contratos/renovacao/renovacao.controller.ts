import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { RenovacaoEngineService } from './renovacao.service';

const DenunciarSchema = z.object({
  motivo: z.string().max(500).optional(),
});

@Controller('contratos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RenovacaoController {
  constructor(private readonly renovacao: RenovacaoEngineService) {}

  /**
   * Regista denúncia tempestiva. Bloqueia renovações automáticas
   * futuras. Apenas LEGAL_LEAD, CONTRACT_MANAGER, ADMIN podem
   * denunciar — BUSINESS_USER não tem capacidade para tomar a
   * decisão.
   */
  @Post(':id/denunciar')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async denunciar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(DenunciarSchema))
    dto: z.infer<typeof DenunciarSchema>,
  ) {
    return this.renovacao.denunciar(
      tenant.tenantId,
      user.sub,
      contratoId,
      dto.motivo ?? null,
    );
  }

  /**
   * Disparo manual do motor de renovação para o tenant actual.
   * Útil para testar fluxos sem esperar pelo cron. Apenas ADMIN.
   */
  @Post('renovacao/run')
  @Roles(Role.ADMIN)
  async runOnce() {
    return this.renovacao.runOnce();
  }
}
