import { ConfigService } from '@nestjs/config';
import { EmbeddingsProvider } from './embeddings.provider';

/**
 * Specs do EmbeddingsProvider — não invocam OpenAI a sério.
 * Testamos: enabled/disabled, batching, formatVector, retry behaviour
 * (mockando fetch).
 */

describe('EmbeddingsProvider', () => {
  const makeConfig = (over: Record<string, string | undefined> = {}) =>
    ({
      get: (key: string) => over[key],
    }) as unknown as ConfigService;

  describe('isEnabled / disabled', () => {
    it('reports disabled when no API key', () => {
      const p = new EmbeddingsProvider(makeConfig());
      expect(p.isEnabled()).toBe(false);
    });

    it('reports enabled with API key', () => {
      const p = new EmbeddingsProvider(makeConfig({ OPENAI_API_KEY: 'sk-test' }));
      expect(p.isEnabled()).toBe(true);
    });

    it('embed() returns null when disabled', async () => {
      const p = new EmbeddingsProvider(makeConfig());
      expect(await p.embed(['hello'])).toBeNull();
      expect(await p.embedOne('hello')).toBeNull();
    });

    it('embed([]) returns [] without hitting API', async () => {
      const p = new EmbeddingsProvider(makeConfig({ OPENAI_API_KEY: 'sk-test' }));
      const spy = jest.spyOn(global, 'fetch');
      const result = await p.embed([]);
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('formatVector', () => {
    it('produces compact pgvector syntax', () => {
      const p = new EmbeddingsProvider(makeConfig());
      expect(p.formatVector([0.1, 0.2, -0.3])).toBe('[0.1,0.2,-0.3]');
    });

    it('handles empty vector', () => {
      const p = new EmbeddingsProvider(makeConfig());
      expect(p.formatVector([])).toBe('[]');
    });
  });

  describe('dimensions', () => {
    it('defaults to 1536', () => {
      const p = new EmbeddingsProvider(makeConfig());
      expect(p.dimension).toBe(1536);
    });

    it('reads OPENAI_EMBED_DIMENSIONS env', () => {
      const p = new EmbeddingsProvider(
        makeConfig({ OPENAI_EMBED_DIMENSIONS: '768' }),
      );
      expect(p.dimension).toBe(768);
    });
  });

  describe('API call (mocked fetch)', () => {
    let originalFetch: typeof global.fetch;
    beforeEach(() => {
      originalFetch = global.fetch;
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('parses successful response and distributes tokens', async () => {
      global.fetch = jest.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              { embedding: [0.1, 0.2], index: 0 },
              { embedding: [0.3, 0.4], index: 1 },
            ],
            usage: { prompt_tokens: 10, total_tokens: 10 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ) as typeof global.fetch;

      const p = new EmbeddingsProvider(makeConfig({ OPENAI_API_KEY: 'sk-test' }));
      const r = await p.embed(['a', 'b']);
      expect(r).not.toBeNull();
      expect(r).toHaveLength(2);
      expect(r![0].embedding).toEqual([0.1, 0.2]);
      expect(r![1].embedding).toEqual([0.3, 0.4]);
      expect(r![0].tokens).toBe(5); // 10 total / 2 inputs
    });

    it('reorders by index when API returns out-of-order', async () => {
      global.fetch = jest.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              { embedding: [9, 9], index: 1 },
              { embedding: [1, 1], index: 0 },
            ],
            usage: { prompt_tokens: 4, total_tokens: 4 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ) as typeof global.fetch;

      const p = new EmbeddingsProvider(makeConfig({ OPENAI_API_KEY: 'sk-test' }));
      const r = await p.embed(['x', 'y']);
      expect(r![0].embedding).toEqual([1, 1]);
      expect(r![1].embedding).toEqual([9, 9]);
    });

    it('retries on 429 then succeeds', async () => {
      let calls = 0;
      global.fetch = jest.fn(async () => {
        calls++;
        if (calls === 1) return new Response('rate limit', { status: 429 });
        return new Response(
          JSON.stringify({
            data: [{ embedding: [0.5], index: 0 }],
            usage: { prompt_tokens: 1, total_tokens: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as typeof global.fetch;

      const p = new EmbeddingsProvider(makeConfig({ OPENAI_API_KEY: 'sk-test' }));
      const r = await p.embed(['a']);
      expect(calls).toBe(2);
      expect(r![0].embedding).toEqual([0.5]);
    });

    it('throws on persistent 4xx (not 429)', async () => {
      global.fetch = jest.fn(async () =>
        new Response('bad request', { status: 400 }),
      ) as typeof global.fetch;

      const p = new EmbeddingsProvider(makeConfig({ OPENAI_API_KEY: 'sk-test' }));
      await expect(p.embed(['a'])).rejects.toThrow(/400/);
    });
  });
});
