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

  @Get('kpis')
  async getKPIs(@GabineteId() gabineteId: string) {
    const kpis = await this.statsService.getKPIs(gabineteId);
    return { data: kpis };
  }

  @Get('taskscore')
  async getTaskscore(
    @GabineteId() gabineteId: string,
    @Query('period') period?: string,
  ) {
    const scores = await this.statsService.getTaskscore(
      gabineteId,
      (period as 'week' | 'month') || 'month',
    );
    return { data: scores };
  }

  @Get('rentabilidade')
  async getRentabilidade(
    @GabineteId() gabineteId: string,
    @Query('processoId') processoId?: string,
  ) {
    const result = await this.statsService.getRentabilidade(
      gabineteId,
      processoId,
    );
    return { data: result };
  }
}
