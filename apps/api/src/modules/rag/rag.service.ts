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
}
