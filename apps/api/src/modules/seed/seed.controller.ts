import {
  Controller,
  Post,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload, KamaiaRole } from '@kamaia/shared-types';
import { SeedService } from './seed.service';

/**
 * Self-service demo data seeder. A SOCIO_GESTOR can trigger this to
 * populate their gabinete's existing processos with realistic related
 * records (timesheets, expenses, prazos, tasks, calendar events) plus
 * one project and one invoice. Idempotent-ish — safe to re-run; only
 * adds rows (duplicates are fine for demo purposes).
 */
@Controller('seed')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class SeedController {
  constructor(private svc: SeedService) {}

  @Post('demo-data')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async demoData(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const r = await this.svc.seedDemoDataForGabinete(gabineteId, user.sub);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: r.data };
  }
}
