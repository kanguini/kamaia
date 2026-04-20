import { Module } from '@nestjs/common';
import { TramitacoesController } from './tramitacoes.controller';
import { TramitacoesService } from './tramitacoes.service';
import { TramitacoesRepository } from './tramitacoes.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PrazosModule } from '../prazos/prazos.module';

@Module({
  imports: [PrismaModule, AuditModule, PrazosModule],
  controllers: [TramitacoesController],
  providers: [TramitacoesService, TramitacoesRepository],
  exports: [TramitacoesService],
})
export class TramitacoesModule {}
