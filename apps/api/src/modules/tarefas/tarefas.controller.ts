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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { TarefasService } from './tarefas.service';
import {
  AddChecklistDto,
  AddChecklistSchema,
  AddComentarioDto,
  AddComentarioSchema,
  CreateColunaDto,
  CreateColunaSchema,
  CreateTarefaDto,
  CreateTarefaSchema,
  ListTarefasQuery,
  ListTarefasQuerySchema,
  TrabalhoQuery,
  TrabalhoQuerySchema,
  UpdateChecklistDto,
  UpdateChecklistSchema,
  UpdateColunaDto,
  UpdateColunaSchema,
  UpdateTarefaDto,
  UpdateTarefaSchema,
} from './tarefas.dto';

const WRITE_ROLES = [
  Role.ADMIN,
  Role.LEGAL_LEAD,
  Role.CONTRACT_MANAGER,
  Role.BUSINESS_USER,
] as const;

@Controller('tarefas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TarefasController {
  constructor(private readonly tarefas: TarefasService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Tenant() tenant: TenantContext,
    @Query(new ParseZodPipe(ListTarefasQuerySchema)) q: ListTarefasQuery,
  ) {
    return this.tarefas.list(tenant.tenantId, q);
  }

  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateTarefaSchema)) dto: CreateTarefaDto,
  ) {
    return this.tarefas.create(tenant.tenantId, user.sub, dto);
  }

  // ANTES de @Get(':id') — rota estática tem de preceder a paramétrica.
  @Get('trabalho')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async trabalho(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(TrabalhoQuerySchema)) q: TrabalhoQuery,
  ) {
    return this.tarefas.trabalho(tenant.tenantId, user.sub, q.dias);
  }

  // ─── Colunas do quadro (rotas estáticas ANTES de :id) ─────────────

  @Get('colunas')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async listColunas(@Tenant() tenant: TenantContext) {
    return this.tarefas.listColunas(tenant.tenantId);
  }

  @Post('colunas')
  @Roles(...WRITE_ROLES)
  async createColuna(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateColunaSchema)) dto: CreateColunaDto,
  ) {
    return this.tarefas.createColuna(tenant.tenantId, user.sub, dto);
  }

  @Patch('colunas/:colunaId')
  @Roles(...WRITE_ROLES)
  async updateColuna(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('colunaId', new ParseUUIDPipe()) colunaId: string,
    @Body(new ParseZodPipe(UpdateColunaSchema)) dto: UpdateColunaDto,
  ) {
    return this.tarefas.updateColuna(tenant.tenantId, user.sub, colunaId, dto);
  }

  @Delete('colunas/:colunaId')
  @Roles(...WRITE_ROLES)
  async removeColuna(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('colunaId', new ParseUUIDPipe()) colunaId: string,
  ) {
    return this.tarefas.removeColuna(tenant.tenantId, user.sub, colunaId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tarefas.get(tenant.tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async update(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateTarefaSchema)) dto: UpdateTarefaDto,
  ) {
    return this.tarefas.update(tenant.tenantId, user.sub, id, dto);
  }

  @Post(':id/concluir')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async concluir(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tarefas.concluir(tenant.tenantId, user.sub, id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async remove(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tarefas.softDelete(tenant.tenantId, user.sub, id);
  }

  // ─── Checklist ────────────────────────────────────────────────────

  @Post(':id/checklist')
  @Roles(...WRITE_ROLES)
  async addChecklist(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(AddChecklistSchema)) dto: AddChecklistDto,
  ) {
    return this.tarefas.addChecklistItem(tenant.tenantId, user.sub, id, dto.texto);
  }

  @Patch(':id/checklist/:itemId')
  @Roles(...WRITE_ROLES)
  async updateChecklist(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body(new ParseZodPipe(UpdateChecklistSchema)) dto: UpdateChecklistDto,
  ) {
    return this.tarefas.updateChecklistItem(tenant.tenantId, user.sub, id, itemId, dto);
  }

  @Delete(':id/checklist/:itemId')
  @Roles(...WRITE_ROLES)
  async removeChecklist(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.tarefas.removeChecklistItem(tenant.tenantId, user.sub, id, itemId);
  }

  // ─── Comentários ──────────────────────────────────────────────────

  @Post(':id/comentarios')
  @Roles(...WRITE_ROLES)
  async addComentario(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(AddComentarioSchema)) dto: AddComentarioDto,
  ) {
    return this.tarefas.addComentario(tenant.tenantId, user.sub, id, dto.texto);
  }

  @Delete(':id/comentarios/:comentarioId')
  @Roles(...WRITE_ROLES)
  async removeComentario(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('comentarioId', new ParseUUIDPipe()) comentarioId: string,
  ) {
    return this.tarefas.removeComentario(tenant.tenantId, user.sub, id, comentarioId);
  }
}
