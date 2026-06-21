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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import { MembershipsService } from './memberships.service';

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role),
});
type InviteDto = z.infer<typeof InviteSchema>;

const UpdateRoleSchema = z.object({
  role: z.nativeEnum(Role),
});
type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;

@Controller('memberships')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  async list(@Tenant() tenant: TenantContext) {
    return this.memberships.list(tenant.tenantId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async invite(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(InviteSchema)) dto: InviteDto,
  ) {
    return this.memberships.invite(tenant.tenantId, user.sub, dto);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateRole(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
  ) {
    return this.memberships.updateRole(id, tenant.tenantId, user.sub, dto.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.memberships.remove(id, tenant.tenantId, user.sub);
  }

  @Post('accept')
  async accept(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
  ) {
    return this.memberships.accept(user.sub, tenant.tenantId);
  }
}
