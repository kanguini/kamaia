import {
  Body,
  Controller,
  Delete,
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
import {
  CreateEntidadeDto,
  CreateEntidadeSchema,
  ListEntidadesQuery,
  ListEntidadesQuerySchema,
  UpdateEntidadeDto,
  UpdateEntidadeSchema,
} from './entidades.dto';
import { EntidadesService } from './entidades.service';

const CreateContactoSchema = z.object({
  nome: z.string().min(2).max(200),
  cargo: z.string().max(100).optional(),
  email: z.string().email().max(200).optional(),
  telefone: z.string().max(30).optional(),
  isPrincipal: z.boolean().optional(),
});

const CreateKycSchema = z.object({
  tipo: z.string().min(2).max(60),
  numero: z.string().max(100).optional(),
  emitidoEm: z.coerce.date().optional(),
  validoAte: z.coerce.date().optional(),
  documentId: z.string().uuid().optional(),
  observacoes: z.string().max(2000).optional(),
});

const BulkImportSchema = z.object({
  linhas: z.array(CreateEntidadeSchema.and(z.object({ _row: z.number().optional() }))).min(1).max(2000),
});

const MergeSchema = z.object({
  sourceId: z.string().uuid(),
});

@Controller('entidades')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EntidadesController {
  constructor(private readonly entidades: EntidadesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query(new ParseZodPipe(ListEntidadesQuerySchema)) q: ListEntidadesQuery,
  ) {
    return this.entidades.list(tenant.tenantId, q);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.entidades.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateEntidadeSchema)) dto: CreateEntidadeDto,
  ) {
    return this.entidades.create(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateEntidadeSchema)) dto: UpdateEntidadeDto,
  ) {
    return this.entidades.update(tenant.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async delete(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('cascade') cascade?: string,
  ) {
    return this.entidades.softDelete(tenant.tenantId, user.sub, id, {
      cascade: cascade === 'true',
    });
  }

  // ─── E.1: Detail page endpoints ───────────────

  @Get(':id/contratos')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async listContratos(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.entidades.listContratos(tenant.tenantId, id);
  }

  @Get(':id/contactos')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async listContactos(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.entidades.listContactos(tenant.tenantId, id);
  }

  @Post(':id/contactos')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async addContacto(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(CreateContactoSchema))
    dto: z.infer<typeof CreateContactoSchema>,
  ) {
    return this.entidades.addContacto(tenant.tenantId, user.sub, id, dto);
  }

  @Delete(':id/contactos/:contactoId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async removeContacto(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('contactoId', new ParseUUIDPipe()) contactoId: string,
  ) {
    return this.entidades.removeContacto(tenant.tenantId, user.sub, id, contactoId);
  }

  @Get(':id/kyc')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async listKyc(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.entidades.listKyc(tenant.tenantId, id);
  }

  @Post(':id/kyc')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async addKyc(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(CreateKycSchema))
    dto: z.infer<typeof CreateKycSchema>,
  ) {
    return this.entidades.addKyc(tenant.tenantId, user.sub, id, dto);
  }

  @Delete(':id/kyc/:kycId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async removeKyc(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('kycId', new ParseUUIDPipe()) kycId: string,
  ) {
    return this.entidades.removeKyc(tenant.tenantId, user.sub, id, kycId);
  }

  // ─── E.6: Bulk import ────────────────────────

  @Post('bulk-import')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async bulkImport(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(BulkImportSchema))
    dto: z.infer<typeof BulkImportSchema>,
  ) {
    return this.entidades.bulkImport(tenant.tenantId, user.sub, dto.linhas);
  }

  // ─── E.7: Merge entidades ────────────────────

  @Post(':id/merge')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async merge(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) targetId: string,
    @Body(new ParseZodPipe(MergeSchema))
    dto: z.infer<typeof MergeSchema>,
  ) {
    return this.entidades.merge(tenant.tenantId, user.sub, targetId, dto.sourceId);
  }

  /**
   * Lista potenciais duplicados no tenant — agrupados por NIF
   * exacto e por nome normalizado. Apenas LEGAL_LEAD/ADMIN porque
   * a UI de seguimento (merge) só é exposta a esses roles.
   */
  @Get('duplicates/scan')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async scanDuplicates(@Tenant() tenant: TenantContext) {
    return this.entidades.findDuplicates(tenant.tenantId);
  }
}
