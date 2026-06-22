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
import { Role, TenantContext } from '@kamaia/shared-types';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { WebhooksService } from './webhooks.service';

const EVENTS_PERMITIDOS = [
  'contrato.criado',
  'contrato.estado_alterado',
  'contrato.assinado',
  'contrato.expira_em_30_dias',
  'contrato.expira_em_7_dias',
  'contrato.janela_denuncia_proxima',
  'contrato.renovacao_automatica_proxima',
  'contrato.terminado',
  'acto_regulatorio.detectado',
  'acto_regulatorio.concluido',
] as const;

const CreateWebhookSchema = z.object({
  nome: z.string().min(2).max(100),
  url: z.string().url().max(500),
  events: z.array(z.enum(EVENTS_PERMITIDOS)).min(1),
});

const UpdateWebhookSchema = z.object({
  nome: z.string().min(2).max(100).optional(),
  url: z.string().url().max(500).optional(),
  events: z.array(z.enum(EVENTS_PERMITIDOS)).min(1).optional(),
  isActive: z.boolean().optional(),
});

@Controller('webhooks')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async list(@Tenant() tenant: TenantContext) {
    return this.webhooks.list(tenant.tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.webhooks.get(tenant.tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(
    @Tenant() tenant: TenantContext,
    @Body(new ParseZodPipe(CreateWebhookSchema))
    dto: z.infer<typeof CreateWebhookSchema>,
  ) {
    return this.webhooks.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateWebhookSchema))
    dto: z.infer<typeof UpdateWebhookSchema>,
  ) {
    return this.webhooks.update(tenant.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.webhooks.remove(tenant.tenantId, id);
  }
}
