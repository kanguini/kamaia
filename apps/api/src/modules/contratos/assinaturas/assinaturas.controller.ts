import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Role, TenantContext } from '@kamaia/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ContratoAssinaturasService } from './assinaturas.service';

@Controller('contratos/:contratoId/assinaturas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoAssinaturasController {
  constructor(
    private readonly assinaturas: ContratoAssinaturasService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
  ) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId: tenant.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) return [];
    return this.assinaturas.list(contratoId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId: tenant.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new Error('Contrato not found');
    return this.assinaturas.get(id);
  }
}
