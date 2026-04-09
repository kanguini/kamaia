import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { IaRepository } from './ia.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [IaController],
  providers: [IaService, IaRepository],
  exports: [IaService],
})
export class IaModule {}
