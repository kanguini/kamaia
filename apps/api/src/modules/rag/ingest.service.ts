import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { RagRepository, InsertChunkData } from './rag.repository';
import { Result, ok, err, LegislationCategory } from '@kamaia/shared-types';

export interface IngestTextInput {
  title: string;
  shortName: string;
  reference: string;
  category: LegislationCategory;
  content: string;
  sourceUrl?: string;
}

interface ParsedChunk {
  title: string;
  content: string;
  tokenCount: number;
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private embeddingService: EmbeddingService,
    private ragRepository: RagRepository,
  ) {}

  async ingestText(input: IngestTextInput): Promise<Result<{ documentId: string; chunksCreated: number }>> {
    try {
      // 1. Create the document record
      const doc = await this.ragRepository.insertDocument({
        title: input.title,
        shortName: input.shortName,
        reference: input.reference,
        category: input.category,
        sourceUrl: input.sourceUrl,
      });

      // 2. Split content into chunks
      const chunks = this.chunkContent(input.content, input.shortName);
      this.logger.log(`Chunked "${input.title}" into ${chunks.length} pieces`);

      // 3. Generate embeddings and insert chunks
      if (this.embeddingService.enabled) {
        const texts = chunks.map((c) => `${c.title}\n${c.content}`);
        const embeddings = await this.embeddingService.generateEmbeddings(texts);

        const chunkData: InsertChunkData[] = chunks.map((c, i) => ({
          documentId: doc.id,
          chunkIndex: i,
          title: c.title,
          content: c.content,
          embedding: embeddings[i],
          tokenCount: c.tokenCount,
        }));

        await this.ragRepository.insertChunks(chunkData);
      } else {
        // Insert without embeddings (can be backfilled later)
        this.logger.warn('Inserting chunks without embeddings (Gemini not configured)');
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          await this.ragRepository.insertChunk({
            documentId: doc.id,
            chunkIndex: i,
            title: c.title,
            content: c.content,
            embedding: [], // Empty — will need backfill
            tokenCount: c.tokenCount,
          });
        }
      }

      this.logger.log(
        `Ingested "${input.title}": ${chunks.length} chunks` +
          (this.embeddingService.enabled ? ' with embeddings' : ' without embeddings'),
      );

      return ok({ documentId: doc.id, chunksCreated: chunks.length });
    } catch (error) {
      this.logger.error(`Ingest failed: ${(error as Error).message}`);
      return err(`Ingest failed: ${(error as Error).message}`, 'INGEST_FAILED');
    }
  }

  async ingestPDF(
    buffer: Buffer,
    metadata: Omit<IngestTextInput, 'content'>,
  ): Promise<Result<{ documentId: string; chunksCreated: number }>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      const text = parsed.text;

      if (!text || text.trim().length === 0) {
        return err('PDF has no extractable text', 'PDF_EMPTY');
      }

      this.logger.log(`Extracted ${text.length} chars from PDF "${metadata.title}"`);

      return this.ingestText({
        ...metadata,
        content: text,
      });
    } catch (error) {
      this.logger.error(`PDF ingest failed: ${(error as Error).message}`);
      return err(`PDF processing failed: ${(error as Error).message}`, 'PDF_PARSE_FAILED');
    }
  }

  /**
   * Split content into chunks, preferring article boundaries.
   * Strategy:
   * 1. Try splitting by article markers (Art. N, Artigo N)
   * 2. If no articles found, split by paragraph (~500 tokens each)
   */
  private chunkContent(content: string, shortName: string): ParsedChunk[] {
    // Try to split by articles first
    const articleRegex = /(?:^|\n)(Art(?:igo)?\.?\s*\d+[°ºo]?(?:\.\s*[°ºo]?)?)/gm;
    const articleMatches = [...content.matchAll(articleRegex)];

    if (articleMatches.length >= 3) {
      return this.chunkByArticles(content, articleMatches, shortName);
    }

    // Fallback: split by paragraphs
    return this.chunkByParagraphs(content, shortName);
  }

  private chunkByArticles(
    content: string,
    matches: RegExpMatchArray[],
    shortName: string,
  ): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];

    for (let i = 0; i < matches.length; i++) {
      const startIdx = matches[i].index!;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : content.length;
      const chunkText = content.slice(startIdx, endIdx).trim();

      if (chunkText.length < 20) continue; // Skip empty articles

      const articleHeader = matches[i][1].trim();
      const title = `${shortName} ${articleHeader}`;
      const tokenCount = Math.ceil(chunkText.length / 4);

      // If chunk is too large (>1000 tokens), split further
      if (tokenCount > 1000) {
        const subChunks = this.splitLargeChunk(chunkText, title);
        chunks.push(...subChunks);
      } else {
        chunks.push({ title, content: chunkText, tokenCount });
      }
    }

    // Include preamble if first article doesn't start at beginning
    if (matches.length > 0 && matches[0].index! > 50) {
      const preamble = content.slice(0, matches[0].index!).trim();
      if (preamble.length > 20) {
        chunks.unshift({
          title: `${shortName} — Preambulo`,
          content: preamble,
          tokenCount: Math.ceil(preamble.length / 4),
        });
      }
    }

    return chunks;
  }

  private chunkByParagraphs(content: string, shortName: string): ParsedChunk[] {
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
    const chunks: ParsedChunk[] = [];
    let currentChunk = '';
    let chunkIdx = 0;

    for (const para of paragraphs) {
      const combined = currentChunk ? `${currentChunk}\n\n${para}` : para;
      const tokenCount = Math.ceil(combined.length / 4);

      if (tokenCount > 500 && currentChunk) {
        // Save current chunk and start new
        chunks.push({
          title: `${shortName} — Seccao ${chunkIdx + 1}`,
          content: currentChunk.trim(),
          tokenCount: Math.ceil(currentChunk.length / 4),
        });
        chunkIdx++;
        currentChunk = para;
      } else {
        currentChunk = combined;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 20) {
      chunks.push({
        title: `${shortName} — Seccao ${chunkIdx + 1}`,
        content: currentChunk.trim(),
        tokenCount: Math.ceil(currentChunk.length / 4),
      });
    }

    return chunks;
  }

  private splitLargeChunk(text: string, baseTitle: string): ParsedChunk[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: ParsedChunk[] = [];
    let current = '';
    let partIdx = 1;

    for (const sentence of sentences) {
      const combined = current ? `${current} ${sentence}` : sentence;
      if (Math.ceil(combined.length / 4) > 500 && current) {
        chunks.push({
          title: `${baseTitle} (parte ${partIdx})`,
          content: current.trim(),
          tokenCount: Math.ceil(current.length / 4),
        });
        partIdx++;
        current = sentence;
      } else {
        current = combined;
      }
    }

    if (current.trim().length > 20) {
      chunks.push({
        title: partIdx > 1 ? `${baseTitle} (parte ${partIdx})` : baseTitle,
        content: current.trim(),
        tokenCount: Math.ceil(current.length / 4),
      });
    }

    return chunks;
  }
}
