import { Module } from '@nestjs/common';
import { GabinetesService } from './gabinetes.service';
import { GabinetesRepository } from './gabinetes.repository';
import { GabinetesController } from './gabinetes.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [GabinetesController],
  providers: [GabinetesService, GabinetesRepository],
  exports: [GabinetesService],
})
export class GabinetesModule {}
