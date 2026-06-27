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
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { z } from 'zod';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { ContratoEventosService } from './eventos.service';

const ComentarSchema = z.object({ texto: z.string().min(1).max(5000) });
const ListEventosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

@Controller('contratos/:contratoId/eventos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoEventosController {
  constructor(private readonly eventos: ContratoEventosService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Query(new ParseZodPipe(ListEventosQuerySchema))
    query: z.infer<typeof ListEventosQuerySchema>,
  ) {
    return this.eventos.list(tenant.tenantId, contratoId, query.limit);
  }

  @Post('comentar')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async comentar(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Body(new ParseZodPipe(ComentarSchema)) dto: z.infer<typeof ComentarSchema>,
  ) {
    return this.eventos.comentar(tenant.tenantId, user.sub, contratoId, dto.texto);
  }
}
