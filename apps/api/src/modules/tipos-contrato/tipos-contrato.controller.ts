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
import {
  Role,
  TenantContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { TiposContratoService } from './tipos-contrato.service';

const CreateTipoSchema = z.object({
  codigo: z.string().min(2).max(80),
  nome: z.string().min(2).max(200),
  categoria: z.nativeEnum(TipoContratoCategoria),
  descricao: z.string().max(2000).optional(),
  tgisVerbaNumero: z.string().max(20).optional(),
  requerNotario: z.boolean().optional(),
  registosRequeridos: z.array(z.string()).optional(),
  gatilhoBNA: z.record(z.string(), z.unknown()).optional(),
  retencaoIRTpadrao: z.boolean().optional(),
  clausulasObrigatorias: z.array(z.string()).optional(),
});
type CreateTipoDto = z.infer<typeof CreateTipoSchema>;

@Controller('tipos-contrato')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TiposContratoController {
  constructor(private readonly tipos: TiposContratoService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query('categoria') categoria?: TipoContratoCategoria,
  ) {
    return this.tipos.list(tenant.tenantId, categoria);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tipos.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async create(
    @Tenant() tenant: TenantContext,
    @Body(new ParseZodPipe(CreateTipoSchema)) dto: CreateTipoDto,
  ) {
    return this.tipos.create(tenant.tenantId, dto);
  }
}
