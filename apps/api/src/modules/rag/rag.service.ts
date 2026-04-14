import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { RagRepository } from './rag.repository';
import { Result, ok, err } from '@kamaia/shared-types';

export interface RAGResult {
  title: string;
  content: string;
  docTitle: string;
  docShortName: string;
  docReference: string;
  distance: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private embeddingService: EmbeddingService,
    private ragRepository: RagRepository,
  ) {}

  get isAvailable(): boolean {
    return this.embeddingService.enabled;
  }

  async retrieveContext(
    query: string,
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<Result<RAGResult[]>> {
    if (!this.embeddingService.enabled) {
      return ok([]); // No embeddings available, return empty
    }

    try {
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);

      const results = await this.ragRepository.searchSimilar(
        queryEmbedding,
        limit,
        threshold,
      );

      const mapped: RAGResult[] = results.map((r) => ({
        title: r.title,
        content: r.content,
        docTitle: r.docTitle,
        docShortName: r.docShortName,
        docReference: r.docReference,
        distance: r.distance,
      }));

      this.logger.debug(
        `RAG: found ${mapped.length} relevant chunks for query "${query.slice(0, 50)}..."`,
      );

      return ok(mapped);
    } catch (error) {
      this.logger.error(`RAG retrieval failed: ${(error as Error).message}`);
      return ok([]); // Graceful degradation — don't block the AI response
    }
  }

  formatContextForPrompt(results: RAGResult[]): string {
    if (results.length === 0) return '';

    const sections = results.map(
      (r) =>
        `### ${r.docShortName} — ${r.title}\n` +
        `_Ref: ${r.docReference}_\n\n` +
        `${r.content}`,
    );

    return (
      `\n\n## LEGISLACAO RELEVANTE (recuperada automaticamente):\n\n` +
      sections.join('\n\n---\n\n')
    );
  }

  async listDocuments(): Promise<Result<any[]>> {
    try {
      const docs = await this.ragRepository.findAllDocuments();
      return ok(docs);
    } catch (error) {
      return err('Failed to list documents', 'RAG_LIST_FAILED');
    }
  }

  async getDocument(id: string): Promise<Result<any>> {
    try {
      const doc = await this.ragRepository.findDocumentById(id);
      if (!doc) {
        return err('Document not found', 'RAG_DOC_NOT_FOUND');
      }
      return ok(doc);
    } catch (error) {
      return err('Failed to get document', 'RAG_DOC_FETCH_FAILED');
    }
  }

  async deleteDocument(id: string): Promise<Result<void>> {
    try {
      const doc = await this.ragRepository.findDocumentById(id);
      if (!doc) {
        return err('Document not found', 'RAG_DOC_NOT_FOUND');
      }
      await this.ragRepository.deleteDocument(id);
      return ok(undefined);
    } catch (error) {
      return err('Failed to delete document', 'RAG_DOC_DELETE_FAILED');
    }
  }

  async getStats(): Promise<
    Result<{ documents: number; chunks: number; embeddingsEnabled: boolean }>
  > {
    try {
      const [documents, chunks] = await Promise.all([
        this.ragRepository.countDocuments(),
        this.ragRepository.countChunks(),
      ]);
      return ok({
        documents,
        chunks,
        embeddingsEnabled: this.embeddingService.enabled,
      });
    } catch (error) {
      return err('Failed to get RAG stats', 'RAG_STATS_FAILED');
    }
  }

  async backfillEmbeddings(): Promise<
    Result<{ processed: number; failed: number; skipped: number }>
  > {
    if (!this.embeddingService.enabled) {
      return err(
        'Embedding service not configured — set GEMINI_API_KEY',
        'EMBEDDINGS_DISABLED',
      );
    }

    try {
      const chunks =
        await this.ragRepository.findChunksWithoutEmbeddings();

      if (chunks.length === 0) {
        return ok({ processed: 0, failed: 0, skipped: 0 });
      }

      this.logger.log(`Backfilling embeddings for ${chunks.length} chunks...`);

      let processed = 0;
      let failed = 0;

      // Process in batches of 5 to respect rate limits
      for (let i = 0; i < chunks.length; i += 5) {
        const batch = chunks.slice(i, i + 5);

        for (const chunk of batch) {
          try {
            const text = `${chunk.title}\n${chunk.content}`;
            const embedding =
              await this.embeddingService.generateEmbedding(text);
            await this.ragRepository.updateChunkEmbedding(chunk.id, embedding);
            processed++;
          } catch (error) {
            this.logger.warn(
              `Failed to embed chunk ${chunk.id}: ${(error as Error).message}`,
            );
            failed++;
          }
        }

        // Rate limit pause between batches
        if (i + 5 < chunks.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.logger.log(
        `Backfill complete: ${processed} processed, ${failed} failed`,
      );

      return ok({ processed, failed, skipped: 0 });
    } catch (error) {
      return err(
        `Backfill failed: ${(error as Error).message}`,
        'BACKFILL_FAILED',
      );
    }
  }
}
