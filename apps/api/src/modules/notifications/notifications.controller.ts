import {
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  ListNotificationsQuery,
  ListNotificationsQuerySchema,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER, Role.EXTERNAL)
  async list(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(ListNotificationsQuerySchema)) q: ListNotificationsQuery,
  ) {
    return this.notifications.listForUser(tenant.tenantId, user.sub, q);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER, Role.EXTERNAL)
  async markRead(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.markRead(tenant.tenantId, user.sub, id);
  }

  @Post('test')
  @Roles(Role.ADMIN)
  async test(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notifications.createTestSet(tenant.tenantId, user.sub);
  }
}
