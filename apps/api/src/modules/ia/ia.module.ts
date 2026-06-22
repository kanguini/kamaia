import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RagModule } from '../rag/rag.module';
import { ClaudeProvider } from './claude.provider';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { IaDraftingService } from './ia-drafting.service';

@Module({
  imports: [RagModule, AuditModule],
  controllers: [IaController],
  providers: [IaService, IaDraftingService, ClaudeProvider],
  exports: [IaService, IaDraftingService],
})
export class IaModule {}
