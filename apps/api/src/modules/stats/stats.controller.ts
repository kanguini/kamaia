import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';

@Controller('stats')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('dashboard')
  async getDashboardStats(@GabineteId() gabineteId: string) {
    const stats = await this.statsService.getDashboardStats(gabineteId);
    return { data: stats };
  }

  @Get('rentabilidade')
  async getRentabilidade(
    @GabineteId() gabineteId: string,
    @Query('processoId') processoId?: string,
  ) {
    const result = await this.statsService.getRentabilidade(gabineteId, processoId);
    return { data: result };
  }
}
