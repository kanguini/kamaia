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
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  CreateCustomFieldDto,
  CreateCustomFieldSchema,
  UpdateCustomFieldDto,
  UpdateCustomFieldSchema,
  UpsertValoresDto,
  UpsertValoresSchema,
} from './custom-fields.dto';
import { CustomFieldsService } from './custom-fields.service';

/**
 * Endpoints de custom fields.
 *
 * Definitions (schema dinâmico):
 *  - Listar:      GET    /custom-fields/by-tipo/:tipoId
 *  - Criar:       POST   /custom-fields/by-tipo/:tipoId   (ADMIN/LEGAL_LEAD)
 *  - Update:      PATCH  /custom-fields/:id               (ADMIN/LEGAL_LEAD)
 *  - Soft delete: DELETE /custom-fields/:id               (ADMIN/LEGAL_LEAD)
 *
 * Valores per-contrato:
 *  - Listar:      GET   /contratos/:contratoId/custom-fields
 *  - Upsert:      PATCH /contratos/:contratoId/custom-fields   (CONTRACT_MANAGER+)
 *
 * Nota: as rotas dos valores estão neste controller (não no
 * ContratosController) para manter coesão do módulo. Frontend
 * usa sempre `/custom-fields/...` como base.
 */
@Controller('custom-fields')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  // ─── Definitions ────────────────────────────────────────────

  @Get('by-tipo/:tipoId')
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  async list(
    @Tenant() tenant: TenantContext,
    @Param('tipoId', new ParseUUIDPipe()) tipoId: string,
  ) {
    return this.service.listByTipo(tipoId, tenant.tenantId);
  }

  @Post('by-tipo/:tipoId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('tipoId', new ParseUUIDPipe()) tipoId: string,
    @Body(new ParseZodPipe(CreateCustomFieldSchema)) dto: CreateCustomFieldDto,
  ) {
    return this.service.create(tipoId, tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateCustomFieldSchema)) dto: UpdateCustomFieldDto,
  ) {
    return this.service.update(id, tenant.tenantId, user.sub, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async remove(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.softDelete(id, tenant.tenantId, user.sub);
  }

  // ─── Valores per-contrato ───────────────────────────────────

  @Get('by-contrato/:contratoId')
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  async listValores(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    return this.service.listValoresByContrato(contratoId, tenant.tenantId);
  }

  @Patch('by-contrato/:contratoId')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async upsertValores(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(UpsertValoresSchema)) dto: UpsertValoresDto,
  ) {
    return this.service.upsertValores(
      contratoId,
      tenant.tenantId,
      user.sub,
      dto,
    );
  }
}
