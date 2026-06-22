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
  ComentarioAutorTipo,
  JwtPayload,
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
import { PrismaService } from '../../prisma/prisma.service';
import { ContratoComentariosService } from './comentarios.service';

const CreateComentarioSchema = z.object({
  clausulaRef: z.string().min(1).max(200),
  texto: z.string().min(1).max(5000),
  versaoId: z.string().uuid().optional(),
  parentComentarioId: z.string().uuid().optional(),
});

@Controller('contratos/:contratoId/comentarios')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoComentariosController {
  constructor(
    private readonly comentarios: ContratoComentariosService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Query('versaoId') versaoId?: string,
    @Query('clausulaRef') clausulaRef?: string,
    @Query('includeResolved') includeResolved?: string,
  ) {
    // Confirma posse
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId: tenant.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) return [];
    return this.comentarios.list(contratoId, {
      tenantId: tenant.tenantId,
      versaoId,
      clausulaRef,
      includeResolved: includeResolved === 'true',
    });
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(CreateComentarioSchema))
    dto: z.infer<typeof CreateComentarioSchema>,
  ) {
    // Hidrata nome do user para denormalizar
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { firstName: true, lastName: true, email: true },
    });
    const autorNome = u ? `${u.firstName} ${u.lastName}`.trim() || u.email : user.email;
    return this.comentarios.create({
      contratoId,
      tenantId: tenant.tenantId,
      versaoId: dto.versaoId,
      clausulaRef: dto.clausulaRef,
      parentComentarioId: dto.parentComentarioId,
      autorTipo: ComentarioAutorTipo.USER,
      autorUserId: user.sub,
      autorNome,
      texto: dto.texto,
    });
  }

  @Patch(':id/resolver')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async resolver(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    // Confirma posse
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId: tenant.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new Error('Contrato not found');
    return this.comentarios.resolver(contratoId, id, user.sub);
  }
}
