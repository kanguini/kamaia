import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { RagModule } from '../rag/rag.module';
import { LegislacaoController } from './legislacao.controller';
import { LegislacaoImportQueueService } from './legislacao-import-queue.service';
import { LexAoImportService } from './lex-ao-import.service';

/**
 * Legislação: ingestão automática (lex.ao → LegislationDocument + chunks)
 * + vista navegável (controller). PrismaService vem do PrismaModule global;
 * RagService (list/get/chunks/embeddings) vem do RagModule.
 */
@Module({
  imports: [RagModule, DocumentsModule],
  controllers: [LegislacaoController],
  providers: [LegislacaoImportQueueService, LexAoImportService],
})
export class LegislacaoModule {}
