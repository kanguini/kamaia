import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { ClaudeProvider } from './claude.provider';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';

@Module({
  imports: [RagModule],
  controllers: [IaController],
  providers: [IaService, ClaudeProvider],
  exports: [IaService],
})
export class IaModule {}
