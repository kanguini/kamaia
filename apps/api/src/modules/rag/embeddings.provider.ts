import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * EmbeddingsProvider — wrapper minimal para o endpoint embeddings da
 * OpenAI (compatível com o modelo `text-embedding-3-small` = 1536 dims).
 *
 * Decisões deliberadas:
 *  - Sem dependência do `openai` SDK. `fetch` nativo do Node 20+
 *    chega para um único endpoint POST.
 *  - Quando `OPENAI_API_KEY` não está definida, `embed()` devolve
 *    `null`. O caller (RagService) detecta e cai no fallback de
 *    pesquisa textual sem partir o fluxo.
 *  - O modelo e dimensões são configuráveis via env, com defaults
 *    alinhados com a coluna `vector(1536)` do schema.
 *  - Backoff exponencial em 429/5xx (até 3 tentativas).
 *  - Batch máximo: 100 inputs por request (a API aceita até 2048,
 *    mas 100 é o sweet spot para latência/custo).
 *
 * Custo @ Junho 2026: ~$0.02 / 1M tokens. Para o catálogo angolano
 * inicial (~10k chunks × ~200 tokens) = ~$0.04 one-shot. Negligível.
 */

export interface EmbeddingResult {
  /** Vector de floats — comprimento = dimensions configuradas. */
  embedding: number[];
  /** Tokens consumidos por este input. */
  tokens: number;
}

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const ENDPOINT = 'https://api.openai.com/v1/embeddings';
const MAX_RETRIES = 3;
const MAX_BATCH = 100;

@Injectable()
export class EmbeddingsProvider {
  private readonly logger = new Logger(EmbeddingsProvider.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.model = this.config.get<string>('OPENAI_EMBED_MODEL') ?? DEFAULT_MODEL;
    this.dimensions =
      Number(this.config.get<string>('OPENAI_EMBED_DIMENSIONS')) ||
      DEFAULT_DIMENSIONS;

    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY não definida — RAG cai em fallback textual.',
      );
    }
  }

  /** `true` quando o provider tem chave configurada e pode gerar embeddings. */
  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Gera embedding para um único texto. Devolve `null` quando o
   * provider está desactivado (sem chave) — caller deve cair no
   * fallback textual em vez de falhar.
   */
  async embedOne(text: string): Promise<EmbeddingResult | null> {
    const [result] = (await this.embed([text])) ?? [];
    return result ?? null;
  }

  /**
   * Gera embeddings em batch. Divide automaticamente em sub-batches
   * de até `MAX_BATCH`. Devolve `null` se desactivado.
   */
  async embed(texts: string[]): Promise<EmbeddingResult[] | null> {
    if (!this.apiKey) return null;
    if (texts.length === 0) return [];

    const results: EmbeddingResult[] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const slice = texts.slice(i, i + MAX_BATCH);
      const batch = await this.callApi(slice);
      results.push(...batch);
    }
    return results;
  }

  /**
   * POST único para o endpoint OpenAI com retry em 429/5xx.
   * Lança em erro persistente — caller decide se aborta ou faz
   * fallback.
   */
  private async callApi(inputs: string[]): Promise<EmbeddingResult[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            input: inputs,
            dimensions: this.dimensions,
          }),
        });

        if (res.status === 429 || res.status >= 500) {
          const wait = 500 * Math.pow(2, attempt); // 0.5s, 1s, 2s
          this.logger.warn(
            `OpenAI embeddings ${res.status}; retry em ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`OpenAI embeddings ${res.status}: ${errText}`);
        }

        const body = (await res.json()) as {
          data: { embedding: number[]; index: number }[];
          usage: { prompt_tokens: number; total_tokens: number };
        };

        // OpenAI devolve `data` ordenado por `index`; ainda assim
        // ordenamos para garantia. Distribui tokens uniformemente
        // (usage é total, não por input — aproximação OK).
        const sorted = [...body.data].sort((a, b) => a.index - b.index);
        const tokensPerInput = Math.ceil(
          body.usage.total_tokens / inputs.length,
        );
        return sorted.map((d) => ({
          embedding: d.embedding,
          tokens: tokensPerInput,
        }));
      } catch (e) {
        lastError = e;
        if (attempt === MAX_RETRIES - 1) throw e;
      }
    }
    throw lastError ?? new Error('Embeddings: unreachable');
  }

  /**
   * Formata um vector para a sintaxe pgvector aceite em SQL raw:
   * `'[0.123,0.456,...]'::vector`. Sem espaços para minimizar tamanho.
   */
  formatVector(v: number[]): string {
    return `[${v.join(',')}]`;
  }

  get dimension(): number {
    return this.dimensions;
  }
}
