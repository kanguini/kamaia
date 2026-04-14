import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.isEnabled = !!apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('Embedding service enabled (text-embedding-004)');
    } else {
      this.logger.warn('Embedding service disabled — no GEMINI_API_KEY');
    }
  }

  get enabled(): boolean {
    return this.isEnabled;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isEnabled || !this.genAI) {
      throw new Error('Embedding service not configured');
    }

    const model = this.genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isEnabled || !this.genAI) {
      throw new Error('Embedding service not configured');
    }

    const model = this.genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (text) => {
          const result = await model.embedContent(text);
          return result.embedding.values;
        }),
      );
      results.push(...batchResults);

      // Small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return results;
  }
}
