import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { RestoreBackupDto, RestoreBackupSchema } from './backup.dto';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  /** Devolve o dump JSON inline. Para datasets enormes deveria streamar. */
  @Post('export')
  @Roles(Role.ADMIN)
  @Header('Content-Type', 'application/json')
  async export(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const { summary, data } = await this.backup.generateDump(
      tenant.tenantId,
      user.sub,
    );
    const filename = `kamaia-backup-${tenant.tenantId.slice(0, 8)}-${summary.id.slice(0, 8)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Kamaia-Backup-Id', summary.id);
    res.setHeader('X-Kamaia-Backup-Size', String(summary.sizeBytes ?? 0));
    // Serialização manual para preservar BigInt
    const json = JSON.stringify({ summary, payload: data }, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    res.status(200).send(json);
  }

  @Get('exports')
  @Roles(Role.ADMIN)
  async list(@Tenant() tenant: TenantContext) {
    return { data: await this.backup.list(tenant.tenantId) };
  }

  /**
   * Restaura um dump JSON para o tenant activo.
   *
   * Body:
   *  - `backup`: o objecto JSON completo (com `summary` + `payload`)
   *  - `dryRun` (default `true`): apenas valida e devolve manifest
   *  - `collisionPolicy` (`skip`|`error`): comportamento em colisão
   *    de IDs com rows existentes
   *
   * Resposta: `{ manifest, summary }`. `manifest.totalWritten` indica
   * o que foi inserido (zero em dry-run).
   *
   * Apenas ADMIN. Tenant alvo é sempre o tenant activo do actor — o
   * `tenantId` original no backup é informativo, é reescrito em cada
   * row. Memberships e AuditLog são saltados de propósito.
   */
  @Post('restore')
  @Roles(Role.ADMIN)
  async restore(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(RestoreBackupSchema)) dto: RestoreBackupDto,
  ) {
    return this.backup.restore(tenant.tenantId, user.sub, dto);
  }
}
