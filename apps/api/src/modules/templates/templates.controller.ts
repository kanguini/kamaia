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
import { TemplatesService } from './templates.service';

const CreateTemplateSchema = z.object({
  tipoId: z.string().uuid(),
  nome: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  conteudo: z.string().min(10),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idiomas: z.array(z.string()).default(['pt-AO']),
});
type CreateTemplateDto = z.infer<typeof CreateTemplateSchema>;

const UpdateTemplateSchema = z.object({
  nome: z.string().min(2).max(200).optional(),
  descricao: z.string().max(2000).optional(),
  conteudo: z.string().min(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
type UpdateTemplateDto = z.infer<typeof UpdateTemplateSchema>;

@Controller('templates')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(@Tenant() tenant: TenantContext, @Query('tipoId') tipoId?: string) {
    return this.templates.list(tenant.tenantId, tipoId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.templates.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateTemplateSchema)) dto: CreateTemplateDto,
  ) {
    return this.templates.create(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async update(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateTemplateSchema)) dto: UpdateTemplateDto,
  ) {
    return this.templates.update(tenant.tenantId, id, dto);
  }
}
