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
  JwtPayload,
  NegociacaoPontoCriticidade,
  NegociacaoPontoEstado,
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
import { ContratoNegociacaoService } from './negociacao.service';

const CreatePontoSchema = z.object({
  clausulaRef: z.string().min(1).max(200),
  titulo: z.string().min(2).max(200),
  resumo: z.string().min(2).max(5000),
  posicaoNos: z.string().max(5000).optional(),
  posicaoContraparte: z.string().max(5000).optional(),
  criticidade: z.nativeEnum(NegociacaoPontoCriticidade).optional(),
  versaoIntroduzidaId: z.string().uuid().optional(),
});
type CreatePontoDto = z.infer<typeof CreatePontoSchema>;

const UpdatePontoSchema = z.object({
  titulo: z.string().min(2).max(200).optional(),
  resumo: z.string().max(5000).optional(),
  posicaoNos: z.string().max(5000).optional(),
  posicaoContraparte: z.string().max(5000).optional(),
  acordoFinal: z.string().max(5000).optional(),
  estado: z.nativeEnum(NegociacaoPontoEstado).optional(),
  criticidade: z.nativeEnum(NegociacaoPontoCriticidade).optional(),
  versaoResolvidaId: z.string().uuid().optional(),
});
type UpdatePontoDto = z.infer<typeof UpdatePontoSchema>;

@Controller('contratos/:contratoId/negociacao')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoNegociacaoController {
  constructor(private readonly neg: ContratoNegociacaoService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.neg.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(CreatePontoSchema)) dto: CreatePontoDto,
  ) {
    return this.neg.create(tenant.tenantId, user.sub, contratoId, dto);
  }

  @Patch(':pontoId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('pontoId', new ParseUUIDPipe()) pontoId: string,
    @Body(new ParseZodPipe(UpdatePontoSchema)) dto: UpdatePontoDto,
  ) {
    return this.neg.update(tenant.tenantId, user.sub, contratoId, pontoId, dto);
  }
}
