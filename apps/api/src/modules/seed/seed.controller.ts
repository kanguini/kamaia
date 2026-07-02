import { Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@kamaia/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SeedService } from './seed.service';

/**
 * Endpoints de seed. Defesa em profundidade (auditoria):
 *  1. JWT + tenant + ADMIN — eram os ÚNICOS endpoints de escrita sem
 *     auth da API; a barreira anterior era apenas NODE_ENV==='production'
 *     exacto, que falha em staging/typo/env vazio.
 *  2. O check de NODE_ENV mantém-se: em produção, o seed corre uma vez
 *     via npm script, nunca por HTTP.
 */
@Controller('seed')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
@SkipThrottle()
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  private assertNaoProducao() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Seed via endpoint is disabled in production');
    }
  }

  @Post('all')
  async all() {
    this.assertNaoProducao();
    return this.seed.seedAll();
  }

  @Post('tgis')
  async tgis() {
    this.assertNaoProducao();
    return this.seed.seedTGIS();
  }

  @Post('tipos-contrato')
  async tipos() {
    this.assertNaoProducao();
    return this.seed.seedTiposContrato();
  }
}
