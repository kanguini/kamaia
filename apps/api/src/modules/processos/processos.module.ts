import { Module } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { ProcessosRepository } from './processos.repository';
import { ProcessosController } from './processos.controller';
import { AuditModule } from '../audit/audit.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [AuditModule, WorkflowsModule],
  controllers: [ProcessosController],
  providers: [ProcessosService, ProcessosRepository],
  exports: [ProcessosService],
})
export class ProcessosModule {}
