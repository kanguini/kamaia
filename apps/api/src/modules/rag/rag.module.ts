import { Module } from '@nestjs/common';
import { EmbeddingsProvider } from './embeddings.provider';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  controllers: [RagController],
  providers: [RagService, EmbeddingsProvider],
  exports: [RagService, EmbeddingsProvider],
})
export class RagModule {}
