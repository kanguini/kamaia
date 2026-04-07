import { Module } from '@nestjs/common';
import { PrazosService } from './prazos.service';
import { PrazosRepository } from './prazos.repository';
import { PrazosController } from './prazos.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PrazosController],
  providers: [PrazosService, PrazosRepository],
  exports: [PrazosService],
})
export class PrazosModule {}
