import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
