import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagRepository } from './rag.repository';
import { EmbeddingService } from './embedding.service';
import { IngestService } from './ingest.service';

@Module({
  controllers: [RagController],
  providers: [RagService, RagRepository, EmbeddingService, IngestService],
  exports: [RagService, EmbeddingService],
})
export class RagModule {}
