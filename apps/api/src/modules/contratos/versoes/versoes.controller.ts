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
  corpoMarkdown: z.string().max(500_000).optional(),
  geradoPorIA: z.boolean().optional(),
});
type CreateVersaoDto = z.infer<typeof CreateVersaoSchema>;

const EditarCorpoSchema = z.object({
  corpoMarkdown: z.string().min(1).max(500_000),
  geradoPorIA: z.boolean().optional(),
});

const DiffQuerySchema = z.object({
  against: z.string().uuid().optional(),
});

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

  @Patch(':versaoId/corpo')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async editarCorpo(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('versaoId', new ParseUUIDPipe()) versaoId: string,
    @Body(new ParseZodPipe(EditarCorpoSchema))
    dto: z.infer<typeof EditarCorpoSchema>,
  ) {
    return this.versoes.editarCorpo(tenant.tenantId, user.sub, contratoId, versaoId, dto);
  }

  /**
   * Diff line-by-line entre esta versão e a anterior.
   * Query param `against` permite escolher outra versão como base
   * (default = imediatamente anterior em ordem).
   */
  @Get(':versaoId/diff')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async diff(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('versaoId', new ParseUUIDPipe()) versaoId: string,
    @Query(new ParseZodPipe(DiffQuerySchema))
    query: z.infer<typeof DiffQuerySchema>,
  ) {
    return this.versoes.diff(tenant.tenantId, contratoId, versaoId, query.against);
  }
}
