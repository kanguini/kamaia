import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente HTTP minimal para a Anthropic Messages API.
 *
 * Sem dependência do `@anthropic-ai/sdk` — usa `fetch` nativo do Node 20+,
 * o que mantém a árvore de dependências leve e elimina questões de
 * compatibilidade de versões. O modelo, temperatura e endpoint são
 * todos configuráveis via env.
 *
 * **Quando `ANTHROPIC_API_KEY` não está definida**, o provider devolve
 * `null` em `complete()`. O `IaService` reconhece e devolve uma resposta
 * placeholder com disclaimer, sem partir o fluxo.
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  text: string;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
}

// ─── Tool use types ──────────────────────────────────────────────
//
// A Anthropic Messages API com tool use usa content blocks
// estruturados em vez de strings. Mantemos os tipos antigos para
// trás-compatibilidade (Q&A) e introduzimos estes para o agente.

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface AnthropicStructuredMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Eventos yieldados pelo streamWithTools(). O AgentService consome
 * este stream e re-emite versões enriquecidas para o frontend SSE.
 */
export type ClaudeStreamEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'tool_use_start'; id: string; name: string }
  | { kind: 'tool_use_input_delta'; id: string; delta: string }
  | {
      kind: 'turn_end';
      /** Indica se o turn parou para chamar tools (`tool_use`) ou
          se respondeu naturalmente (`end_turn`). */
      stopReason: 'tool_use' | 'end_turn' | 'max_tokens' | 'unknown';
      /** Snapshot dos content blocks construídos durante o turn. */
      content: AnthropicContentBlock[];
      modelo: string;
      tokensInput: number;
      tokensOutput: number;
    }
  | { kind: 'error'; message: string };

// Alias sem sufixo de data (recomendado pela Anthropic — IDs datados
// podem ser retirados de serviço). Opus para o agente com tool-use;
// sobreponível por env CLAUDE_MODEL.
const DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_TOKENS = 2048;
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Status retryable da Anthropic: 429 (rate limit), 500/502/503
// (transitórios), 529 (overloaded). 4xx restantes são fatais.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `És o Dr. Kamaia — o assistente jurídico do Kamaia CLM, uma plataforma de Contract Lifecycle Management para Angola e PALOP.

A tua função é responder a perguntas sobre legislação angolana com rigor e citações ao artigo aplicável. Quando relevante, cita o diploma (e.g. "Decreto Legislativo Presidencial n.º 3/14, art. 12.º") e a referência da TGIS quando o assunto for Imposto de Selo.

REGRAS DE OURO:
- Responde em português europeu de Angola (pt-AO).
- Se não tiveres certeza sobre uma norma, di-lo explicitamente em vez de inventar.
- Cita SEMPRE a fonte legal quando afirmares algo concreto.
- Quando o utilizador descrever um caso concreto, indica QUAIS os actos regulatórios típicos (Imposto de Selo, registos, BNA, AGT) e prazos legais aplicáveis.
- Mantém respostas concisas — máximo 6-8 parágrafos.`;

@Injectable()
export class ClaudeProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.model = config.get<string>('CLAUDE_MODEL', DEFAULT_MODEL);
    this.maxTokens = parseInt(
      config.get<string>('CLAUDE_MAX_TOKENS', String(DEFAULT_MAX_TOKENS)),
      10,
    );

    if (!this.apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY não definida — IA opera em modo stub. Configure a chave para activar respostas reais.',
      );
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * POST à Anthropic com retry/backoff para status retryable (429/5xx/529)
   * e propagação de AbortSignal. Devolve o `Response` (corpo NÃO consumido,
   * para o caller fazer stream). Lança em abort, erro de rede esgotado, ou
   * status fatal após drenar o corpo.
   */
  private async fetchAnthropic(
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey as string,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
          signal,
        });
      } catch (e) {
        if (signal?.aborted) throw e; // abort — não faz retry
        lastErr = e;
        if (attempt < MAX_RETRIES) {
          await this.backoff(attempt, signal);
          continue;
        }
        throw e;
      }

      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await res.body?.cancel().catch(() => undefined); // liberta a ligação
        this.logger.warn(
          `Anthropic ${res.status} — retry ${attempt + 1}/${MAX_RETRIES}`,
        );
        await this.backoff(
          attempt,
          signal,
          Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
        );
        continue;
      }
      return res;
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('Falha ao contactar a IA após múltiplas tentativas.');
  }

  /** Espera exponencial com jitter (ou `retry-after` quando dado). */
  private async backoff(
    attempt: number,
    signal?: AbortSignal,
    retryAfterMs?: number,
  ): Promise<void> {
    const base = retryAfterMs ?? Math.min(8000, 500 * 2 ** attempt);
    const wait = base + base * 0.25 * Math.random();
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, wait);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  /**
   * Chama a Anthropic Messages API. Devolve `null` se a chave não está
   * configurada. Throwa em erros de rede / API — o caller decide se
   * cai para stub.
   */
  async complete(
    messages: ClaudeMessage[],
    legislacaoContext?: string,
    /**
     * Substitui o SYSTEM_PROMPT por completo. Usar quando o caller tem
     * um prompt especializado (e.g. drafting de contratos onde o output
     * deve ser puro markdown sem disclaimers ou citações inline).
     * Se omitido, usa o SYSTEM_PROMPT genérico Q&A.
     */
    systemOverride?: string,
    /**
     * Override de max_tokens. Drafting de contratos pode precisar
     * 4k-8k para uma minuta completa, enquanto Q&A normal usa 2k.
     */
    maxTokensOverride?: number,
    signal?: AbortSignal,
  ): Promise<ClaudeResponse | null> {
    if (!this.apiKey) return null;

    const baseSystem = systemOverride ?? SYSTEM_PROMPT;
    const systemPrompt = legislacaoContext
      ? `${baseSystem}\n\n=== Contexto da legislação angolana ===\n${legislacaoContext}`
      : baseSystem;

    const body = {
      model: this.model,
      max_tokens: maxTokensOverride ?? this.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    let res: Response;
    try {
      res = await this.fetchAnthropic(body, signal);
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') throw e;
      this.logger.error(
        `Falha de rede ao chamar Anthropic: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new Error('Falha de rede ao consultar a IA. Tenta de novo em instantes.');
    }

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`Anthropic API ${res.status}: ${errBody.slice(0, 300)}`);
      throw new Error(`Erro da IA (${res.status}). Tenta de novo em instantes.`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      model: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();

    return {
      text,
      modelo: data.model,
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    };
  }

  /**
   * Variante streaming do `complete()`. Usa Server-Sent Events (SSE)
   * conforme protocolo Anthropic Messages API com `stream: true`.
   *
   * Devolve um async generator que yields chunks de texto à medida que
   * chegam, terminando com um objecto `{ done: true, modelo, tokensInput,
   * tokensOutput }`.
   *
   * Quando a key não está configurada, yield uma única vez com mensagem
   * placeholder e termina — mesmo padrão do complete().
   */
  async *completeStream(
    messages: ClaudeMessage[],
    legislacaoContext?: string,
    systemOverride?: string,
    maxTokensOverride?: number,
    signal?: AbortSignal,
  ): AsyncGenerator<
    | { kind: 'text'; delta: string }
    | { kind: 'done'; modelo: string; tokensInput: number; tokensOutput: number }
    | { kind: 'error'; message: string }
  > {
    if (!this.apiKey) {
      yield {
        kind: 'error',
        message: 'Stream indisponível — ANTHROPIC_API_KEY ausente.',
      };
      return;
    }

    const baseSystem = systemOverride ?? SYSTEM_PROMPT;
    const systemPrompt = legislacaoContext
      ? `${baseSystem}\n\n=== Contexto da legislação angolana ===\n${legislacaoContext}`
      : baseSystem;

    const body = {
      model: this.model,
      max_tokens: maxTokensOverride ?? this.maxTokens,
      stream: true,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    let res: Response;
    try {
      res = await this.fetchAnthropic(body, signal);
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') return;
      this.logger.error(
        `completeStream rede: ${e instanceof Error ? e.message : String(e)}`,
      );
      yield { kind: 'error', message: 'Falha de rede ao consultar a IA.' };
      return;
    }

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      this.logger.error(
        `Anthropic stream ${res.status}: ${txt.slice(0, 200)}`,
      );
      yield {
        kind: 'error',
        message: `Erro IA (${res.status})`,
      };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let modelo = this.model;
    let tokensInput = 0;
    let tokensOutput = 0;

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel().catch(() => undefined);
          return;
        }
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE format: `event: <name>\ndata: <json>\n\n`
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const block of events) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const json = dataLine.slice(6).trim();
          if (!json || json === '[DONE]') continue;
          try {
            const obj = JSON.parse(json) as {
              type: string;
              delta?: { type: string; text?: string };
              message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
              usage?: { input_tokens?: number; output_tokens?: number };
            };
            if (obj.type === 'message_start' && obj.message?.model) {
              modelo = obj.message.model;
              tokensInput = obj.message.usage?.input_tokens ?? 0;
            } else if (
              obj.type === 'content_block_delta' &&
              obj.delta?.type === 'text_delta' &&
              obj.delta.text
            ) {
              yield { kind: 'text', delta: obj.delta.text };
            } else if (obj.type === 'message_delta' && obj.usage) {
              tokensOutput = obj.usage.output_tokens ?? tokensOutput;
            }
          } catch {
            // ignora linhas JSON malformadas (ping events, etc.)
          }
        }
      }
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') return;
      this.logger.error(
        `completeStream read: ${e instanceof Error ? e.message : String(e)}`,
      );
      yield { kind: 'error', message: 'Erro ao processar a resposta da IA.' };
      return;
    }

    yield { kind: 'done', modelo, tokensInput, tokensOutput };
  }

  /**
   * Stream agêntico — variante com tool use.
   *
   * Aceita mensagens estruturadas (content pode ser string ou array
   * de content blocks com tool_use/tool_result) e uma lista de tools.
   *
   * Eventos yieldados:
   *  - text: delta de texto (mesma semântica do completeStream)
   *  - tool_use_start: tool_use iniciado, com id e name
   *  - tool_use_input_delta: chunks JSON dos args (input_json_delta)
   *  - turn_end: turn terminou. `stopReason='tool_use'` significa
   *    que Claude pediu para executar tools; caller faz round-trip.
   *  - error: erro
   *
   * Caller (AgentService) deve fazer o loop multi-turn: ao receber
   * `turn_end` com `stopReason='tool_use'`, executa as tools, anexa
   * tool_result à conversation, chama de novo.
   */
  async *streamWithTools(
    messages: AnthropicStructuredMessage[],
    tools: AnthropicToolSpec[],
    systemPrompt: string,
    maxTokens?: number,
    signal?: AbortSignal,
  ): AsyncGenerator<ClaudeStreamEvent> {
    if (!this.apiKey) {
      yield {
        kind: 'error',
        message: 'Stream com tools indisponível — ANTHROPIC_API_KEY ausente.',
      };
      return;
    }

    // Prompt caching: o system prompt e as tool specs são estáveis ao
    // longo dos até 6 turns da MESMA conversa. Marcá-los com
    // cache_control ephemeral faz a Anthropic reler do cache (~10% do
    // custo) em vez de reprocessar tudo a preço cheio em cada turn —
    // corta a maior fatia do custo de input do loop agêntico.
    const systemBlocks = [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ];
    const cachedTools =
      tools.length > 0
        ? tools.map((t, i) =>
            i === tools.length - 1
              ? { ...t, cache_control: { type: 'ephemeral' as const } }
              : t,
          )
        : [];

    const body = {
      model: this.model,
      max_tokens: maxTokens ?? this.maxTokens,
      stream: true,
      system: systemBlocks,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(cachedTools.length > 0 ? { tools: cachedTools } : {}),
    };

    let res: Response;
    try {
      res = await this.fetchAnthropic(body, signal);
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') return;
      this.logger.error(
        `streamWithTools rede: ${e instanceof Error ? e.message : String(e)}`,
      );
      yield { kind: 'error', message: 'Falha de rede ao consultar a IA.' };
      return;
    }

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      this.logger.error(
        `Anthropic streamWithTools ${res.status}: ${txt.slice(0, 400)}`,
      );
      yield { kind: 'error', message: `Erro IA (${res.status})` };
      return;
    }

    // Estado acumulado por content block (indexado por block index)
    const blocks = new Map<
      number,
      {
        type: 'text' | 'tool_use';
        // text
        text?: string;
        // tool_use
        id?: string;
        name?: string;
        inputJson?: string;
      }
    >();
    let modelo = this.model;
    let tokensInput = 0;
    let tokensOutput = 0;
    let stopReason: 'tool_use' | 'end_turn' | 'max_tokens' | 'unknown' =
      'unknown';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel().catch(() => undefined);
          return;
        }
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const block of events) {
          const dataLine = block
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const json = dataLine.slice(6).trim();
          if (!json || json === '[DONE]') continue;

          let obj: {
            type: string;
            index?: number;
            delta?: {
              type?: string;
              text?: string;
              partial_json?: string;
              stop_reason?: string;
            };
            content_block?: {
              type?: string;
              id?: string;
              name?: string;
              text?: string;
              input?: Record<string, unknown>;
            };
            message?: {
              model?: string;
              usage?: { input_tokens?: number; output_tokens?: number };
              stop_reason?: string;
            };
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          try {
            obj = JSON.parse(json);
          } catch {
            continue;
          }

          if (obj.type === 'message_start' && obj.message) {
            if (obj.message.model) modelo = obj.message.model;
            tokensInput = obj.message.usage?.input_tokens ?? 0;
          } else if (obj.type === 'content_block_start') {
            const idx = obj.index ?? -1;
            const cb = obj.content_block;
            if (cb?.type === 'text') {
              blocks.set(idx, { type: 'text', text: '' });
            } else if (cb?.type === 'tool_use') {
              blocks.set(idx, {
                type: 'tool_use',
                id: cb.id,
                name: cb.name,
                inputJson: '',
              });
              if (cb.id && cb.name) {
                yield { kind: 'tool_use_start', id: cb.id, name: cb.name };
              }
            }
          } else if (obj.type === 'content_block_delta') {
            const idx = obj.index ?? -1;
            const entry = blocks.get(idx);
            if (!entry) continue;
            if (obj.delta?.type === 'text_delta' && obj.delta.text) {
              entry.text = (entry.text ?? '') + obj.delta.text;
              yield { kind: 'text', delta: obj.delta.text };
            } else if (
              obj.delta?.type === 'input_json_delta' &&
              obj.delta.partial_json
            ) {
              entry.inputJson = (entry.inputJson ?? '') + obj.delta.partial_json;
              if (entry.id) {
                yield {
                  kind: 'tool_use_input_delta',
                  id: entry.id,
                  delta: obj.delta.partial_json,
                };
              }
            }
          } else if (obj.type === 'content_block_stop') {
            // No-op — block is complete, content já está acumulado
          } else if (obj.type === 'message_delta') {
            const sr = obj.delta?.stop_reason;
            if (sr === 'tool_use') stopReason = 'tool_use';
            else if (sr === 'end_turn') stopReason = 'end_turn';
            else if (sr === 'max_tokens') stopReason = 'max_tokens';
            if (obj.usage) tokensOutput = obj.usage.output_tokens ?? tokensOutput;
          } else if (obj.type === 'message_stop') {
            // sinaliza fim
          }
        }
      }
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') return;
      this.logger.error(
        `streamWithTools read: ${e instanceof Error ? e.message : String(e)}`,
      );
      yield { kind: 'error', message: 'Erro ao processar a resposta da IA.' };
      return;
    }

    // Compila os content blocks finais por ordem de index
    const finalContent: AnthropicContentBlock[] = [];
    const indices = Array.from(blocks.keys()).sort((a, b) => a - b);
    for (const i of indices) {
      const b = blocks.get(i)!;
      if (b.type === 'text' && b.text) {
        finalContent.push({ type: 'text', text: b.text });
      } else if (b.type === 'tool_use' && b.id && b.name) {
        let input: Record<string, unknown> = {};
        if (b.inputJson) {
          try {
            input = JSON.parse(b.inputJson) as Record<string, unknown>;
          } catch {
            // input parcialmente recebido — mantém vazio. Tool layer
            // detectará via Zod e devolverá INVALID_ARGS, Claude
            // recupera no próximo turn.
          }
        }
        finalContent.push({
          type: 'tool_use',
          id: b.id,
          name: b.name,
          input,
        });
      }
    }

    yield {
      kind: 'turn_end',
      stopReason,
      content: finalContent,
      modelo,
      tokensInput,
      tokensOutput,
    };
  }
}
