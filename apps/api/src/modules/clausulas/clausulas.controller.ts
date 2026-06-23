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
import { ClausulasService } from './clausulas.service';

const ListClausulasSchema = z.object({
  q: z.string().optional(),
  categoria: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tipoContratoCodigo: z.string().optional(),
  includeUnapproved: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

const CreateClausulaSchema = z.object({
  categoria: z.string().min(2).max(60),
  titulo: z.string().min(2).max(200),
  conteudo: z.string().min(5),
  leiAplicavelArt: z.string().max(300).optional(),
  tags: z.array(z.string()).default([]),
  tipoContratoCodigos: z.array(z.string()).default([]),
  idioma: z.string().default('pt-AO'),
  origemContratoId: z.string().uuid().optional(),
});
type CreateClausulaDto = z.infer<typeof CreateClausulaSchema>;

const UpdateClausulaSchema = z.object({
  titulo: z.string().min(2).max(200).optional(),
  conteudo: z.string().min(5).optional(),
  categoria: z.string().min(2).max(60).optional(),
  tags: z.array(z.string()).optional(),
  tipoContratoCodigos: z.array(z.string()).optional(),
  leiAplicavelArt: z.string().max(300).optional(),
});

@Controller('clausulas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ClausulasController {
  constructor(private readonly clausulas: ClausulasService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query(new ParseZodPipe(ListClausulasSchema))
    q: z.infer<typeof ListClausulasSchema>,
  ) {
    // Role vem do TenantContext (TenantGuard resolve via Membership)
    return this.clausulas.list(tenant.tenantId, q, tenant.role);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.clausulas.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateClausulaSchema)) dto: CreateClausulaDto,
  ) {
    return this.clausulas.create(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateClausulaSchema))
    dto: z.infer<typeof UpdateClausulaSchema>,
  ) {
    return this.clausulas.update(tenant.tenantId, user.sub, id, dto);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async approve(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.clausulas.approve(tenant.tenantId, user.sub, id);
  }
}
