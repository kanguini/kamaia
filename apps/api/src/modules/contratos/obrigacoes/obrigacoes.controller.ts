import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  JwtPayload,
  ObrigacaoPeriodicidade,
  ObrigacaoTipo,
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
import { ContratoObrigacoesService } from './obrigacoes.service';

const CreateObrigacaoSchema = z.object({
  parteResponsavelId: z.string().uuid(),
  tipo: z.nativeEnum(ObrigacaoTipo),
  descricao: z.string().min(2).max(2000),
  periodicidade: z.nativeEnum(ObrigacaoPeriodicidade),
  proximaData: z.coerce.date().optional(),
  valorEsperado: z.coerce.bigint().optional(),
  moeda: z.string().length(3).optional(),
  alertaDias: z.array(z.number().int().positive()).optional(),
});

const CumprirInstanciaSchema = z.object({
  dataReal: z.coerce.date().optional(),
  valorReal: z.coerce.bigint().optional(),
  comprovativoId: z.string().uuid().optional(),
  observacoes: z.string().max(2000).optional(),
});

const DispensarInstanciaSchema = z.object({
  motivo: z.string().min(5).max(2000),
});

@Controller('contratos/:contratoId/obrigacoes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoObrigacoesController {
  constructor(private readonly obrigacoes: ContratoObrigacoesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.obrigacoes.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(CreateObrigacaoSchema))
    dto: z.infer<typeof CreateObrigacaoSchema>,
  ) {
    return this.obrigacoes.create(tenant.tenantId, user.sub, contratoId, dto);
  }

  @Patch('instancias/:instanciaId/cumprir')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async cumprir(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('instanciaId', new ParseUUIDPipe()) instanciaId: string,
    @Body(new ParseZodPipe(CumprirInstanciaSchema))
    dto: z.infer<typeof CumprirInstanciaSchema>,
  ) {
    return this.obrigacoes.cumprirInstancia(
      tenant.tenantId,
      user.sub,
      contratoId,
      instanciaId,
      dto,
    );
  }

  @Patch('instancias/:instanciaId/dispensar')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async dispensar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('instanciaId', new ParseUUIDPipe()) instanciaId: string,
    @Body(new ParseZodPipe(DispensarInstanciaSchema))
    dto: z.infer<typeof DispensarInstanciaSchema>,
  ) {
    return this.obrigacoes.dispensarInstancia(
      tenant.tenantId,
      user.sub,
      contratoId,
      instanciaId,
      dto,
    );
  }

  @Delete(':obrigacaoId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async desactivar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('obrigacaoId', new ParseUUIDPipe()) obrigacaoId: string,
  ) {
    return this.obrigacoes.desactivar(
      tenant.tenantId,
      user.sub,
      contratoId,
      obrigacaoId,
    );
  }
}
