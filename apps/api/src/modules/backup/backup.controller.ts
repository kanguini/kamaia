import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Post('export')
  @Roles(Role.ADMIN)
  async requestExport(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
  ) {
    const entry = await this.backup.requestExport(tenant.tenantId, user.sub);
    return { status: entry.status, estimatedSeconds: entry.estimatedSeconds, id: entry.id };
  }

  @Get('exports')
  @Roles(Role.ADMIN)
  async list(@Tenant() tenant: TenantContext) {
    return { data: this.backup.list(tenant.tenantId) };
  }
}
