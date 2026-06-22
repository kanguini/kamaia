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

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = 2048;
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT = `És o assistente jurídico do Kamaia CLM — uma plataforma de Contract Lifecycle Management para Angola e PALOP.

A tua função é responder a perguntas sobre legislação angolana com rigor e citações ao artigo aplicável. Quando relevante, cita o diploma (e.g. "Decreto Legislativo Presidencial n.º 3/14, art. 12.º") e a referência da TGIS quando o assunto for Imposto de Selo.

REGRAS DE OURO:
- Responde em português europeu de Angola (pt-AO).
- Se não tiveres certeza sobre uma norma, di-lo explicitamente em vez de inventar.
- Cita SEMPRE a fonte legal quando afirmares algo concreto.
- Termina sempre com: "⚠ Esta resposta não substitui aconselhamento jurídico profissional."
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
   * Chama a Anthropic Messages API. Devolve `null` se a chave não está
   * configurada. Throwa em erros de rede / API — o caller decide se
   * cai para stub.
   */
  async complete(
    messages: ClaudeMessage[],
    legislacaoContext?: string,
  ): Promise<ClaudeResponse | null> {
    if (!this.apiKey) return null;

    const systemPrompt = legislacaoContext
      ? `${SYSTEM_PROMPT}\n\n=== Contexto da legislação angolana ===\n${legislacaoContext}`
      : SYSTEM_PROMPT;

    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
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
}
