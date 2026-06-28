import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { LegislacaoImportQueueService } from './legislacao-import-queue.service';
import { LexAoImportService } from './lex-ao-import.service';

/**
 * Ingestão automática de legislação (lex.ao → LegislationDocument + chunks).
 * PrismaService vem do PrismaModule global; RagService (chunks/embeddings)
 * vem do RagModule.
 */
@Module({
  imports: [RagModule],
  providers: [LegislacaoImportQueueService, LexAoImportService],
})
export class LegislacaoModule {}
