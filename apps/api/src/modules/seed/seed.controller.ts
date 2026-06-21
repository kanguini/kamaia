import { Controller, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SeedService } from './seed.service';

/**
 * Endpoints de seed — restrictos a NODE_ENV !== 'production' por
 * segurança. Em produção, o seed corre uma vez via npm script.
 */
@Controller('seed')
@SkipThrottle()
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  @Post('all')
  async all() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Seed via endpoint is disabled in production' };
    }
    return this.seed.seedAll();
  }

  @Post('tgis')
  async tgis() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Seed disabled in production' };
    }
    return this.seed.seedTGIS();
  }

  @Post('tipos-contrato')
  async tipos() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Seed disabled in production' };
    }
    return this.seed.seedTiposContrato();
  }
}
