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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  CreateConversationDto,
  CreateConversationSchema,
  ListConversationsQuery,
  ListConversationsQuerySchema,
  SendMessageDto,
  SendMessageSchema,
} from './ia.dto';
import { IaService } from './ia.service';

@Controller('ia')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class IaController {
  constructor(private readonly ia: IaService) {}

  @Get('conversations')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async list(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(ListConversationsQuerySchema)) q: ListConversationsQuery,
  ) {
    return this.ia.list(tenant.tenantId, user.sub, q);
  }

  @Get('conversations/:id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async get(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ia.get(tenant.tenantId, user.sub, id);
  }

  @Post('conversations')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateConversationSchema)) dto: CreateConversationDto,
  ) {
    return this.ia.createConversation(tenant.tenantId, user.sub, dto);
  }

  @Post('conversations/:id/messages')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async send(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(SendMessageSchema)) dto: SendMessageDto,
  ) {
    return this.ia.sendMessage(tenant.tenantId, user.sub, id, dto);
  }
}
