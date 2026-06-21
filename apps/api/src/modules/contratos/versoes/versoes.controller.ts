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
  VersaoDireccao,
} from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { ContratoVersoesService } from './versoes.service';

const CreateVersaoSchema = z.object({
  versao: z.string().min(1).max(20),
  direccao: z.nativeEnum(VersaoDireccao),
  documentId: z.string().uuid().optional(),
  hashSHA256: z.string().length(64).optional(),
  comentario: z.string().max(2000).optional(),
});
type CreateVersaoDto = z.infer<typeof CreateVersaoSchema>;

@Controller('contratos/:contratoId/versoes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoVersoesController {
  constructor(private readonly versoes: ContratoVersoesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.versoes.list(tenant.tenantId, contratoId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(CreateVersaoSchema)) dto: CreateVersaoDto,
  ) {
    return this.versoes.create(tenant.tenantId, user.sub, contratoId, dto);
  }
}
