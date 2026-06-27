import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Wrapper que apaga os tipos genéricos profundos do zod-to-json-schema.
 * O compiler estoura com TS2589 quando o registry tem schemas
 * heterogéneos; aqui forçamos `any` na assinatura para escapar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertSchemaToJson = (s: unknown): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodToJsonSchema(s as any, { target: 'openApi3', $refStrategy: 'none' });
import type {
  ToolContext,
  ToolDefinition,
  ToolExecutionResult,
} from './tool.types';
import { AuditService } from '../../audit/audit.service';

/**
 * Erros estruturados que a tool execution layer devolve a Claude
 * como `tool_result` com `is_error: true`. Claude vê e adapta a
 * próxima resposta sem rebentar a conversação.
 */
export interface ToolError {
  code:
    | 'TOOL_NOT_FOUND'
    | 'FORBIDDEN'
    | 'INVALID_ARGS'
    | 'EXECUTION_ERROR'
    | 'NOT_FOUND'
    | 'CONFIRMATION_REQUIRED';
  message: string;
  details?: unknown;
}

/**
 * Spec da tool no formato que a Anthropic API espera no body de
 * `messages.create`. Gerado a partir do schema Zod.
 */
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
 * ToolRegistry — central registry das tools agênticas.
 *
 * Responsabilidades:
 *  - Manter o catálogo de tools registadas
 *  - Filtrar quais estão disponíveis para uma role específica
 *  - Validar args com Zod ANTES de invocar a implementação
 *  - Enforce RBAC (role check)
 *  - Garantir tenantId/userId vêm do contexto, NÃO do payload
 *  - Gerar audit log para cada tool call (especialmente mutações)
 *  - Converter Zod schemas em JSON Schema da Anthropic
 *
 * Isolamento de segurança:
 *  - LLM nunca vê tenantId no schema (não é parte dos args declarados)
 *  - Tool execute() recebe ctx separado dos args
 *  - Even se o LLM tentar mandar tenantId nos args, é validado e
 *    ignorado — usamos sempre o ctx.tenantId da sessão autenticada
 */
@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  constructor(private readonly audit: AuditService) {}

  /**
   * Regista uma tool. Lança se o nome já existe — evita silenciar
   * mistakes de duplicate registration.
   */
  register<TArgs, TResult>(tool: ToolDefinition<TArgs, TResult>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" já registada`);
    }
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
    this.logger.log(
      `Tool registada: ${tool.name} (roles=${tool.requiredRoles.join(',') || 'ANY'}, mutates=${tool.mutates})`,
    );
  }

  registerAll(tools: ToolDefinition<unknown, unknown>[]): void {
    for (const t of tools) this.register(t);
  }

  /**
   * Devolve as tools que uma role específica pode invocar — usado
   * para gerar a lista que vai no body da request a Claude. Filtrar
   * por role aqui evita expor capacidades que o user não pode usar.
   */
  availableFor(role: Role): ToolDefinition<unknown, unknown>[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.requiredRoles.length === 0 || t.requiredRoles.includes(role),
    );
  }

  /** Converte uma tool registada para o spec esperado pela Anthropic. */
  toAnthropicSpec(tool: ToolDefinition<unknown, unknown>): AnthropicToolSpec {
    const schema = convertSchemaToJson(tool.schema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: schema.properties ?? {},
        ...(schema.required && schema.required.length > 0
          ? { required: schema.required }
          : {}),
      },
    };
  }

  /** Spec list pronta para enviar a Claude para uma dada role. */
  specsFor(role: Role): AnthropicToolSpec[] {
    return this.availableFor(role).map((t) => this.toAnthropicSpec(t));
  }

  /**
   * Executa uma tool por nome. Faz toda a validação + RBAC + audit.
   *
   * NUNCA lança — devolve um ToolError estruturado em vez disso para
   * que Claude possa adaptar a resposta sem partir a conversação.
   * (Excepções inesperadas são capturadas e convertidas em
   * EXECUTION_ERROR.)
   */
  async execute<TResult = unknown>(
    name: string,
    rawArgs: unknown,
    ctx: ToolContext,
  ): Promise<ToolExecutionResult<TResult> | { error: ToolError }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `A tool "${name}" não existe. Tools disponíveis: ${Array.from(
            this.tools.keys(),
          ).join(', ')}`,
        },
      };
    }

    // RBAC
    if (
      tool.requiredRoles.length > 0 &&
      !tool.requiredRoles.includes(ctx.role)
    ) {
      return {
        error: {
          code: 'FORBIDDEN',
          message: `A role ${ctx.role} não pode invocar "${name}". Requer: ${tool.requiredRoles.join(', ')}`,
        },
      };
    }

    // Validação Zod dos args
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        error: {
          code: 'INVALID_ARGS',
          message: `Args inválidos para "${name}"`,
          details: parsed.error.flatten(),
        },
      };
    }

    // Gate de confirmação humana — tools que mutam estado NÃO são
    // executadas sem confirmação explícita do utilizador. Esta é a
    // barreira real ("o engine sugere, o humano confirma"): não confia
    // no LLM "perguntar antes" via prompt. Devolve sem executar; o
    // agente surface-a como pedido de confirmação e o frontend mostra
    // Confirmar/Cancelar. Ao confirmar, o turn corre com allowMutations.
    // O predicado é fornecido por cada tool — protege a invariante
    // "execute() nunca lança": se rebentar, fail-closed (exige
    // confirmação) em vez de propagar e partir o stream.
    let needsConfirm: boolean;
    try {
      needsConfirm = tool.needsConfirmation
        ? tool.needsConfirmation(parsed.data)
        : tool.mutates;
    } catch {
      needsConfirm = true;
    }
    if (needsConfirm && !ctx.allowMutations) {
      return {
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message:
            `A acção "${name}" altera dados e requer confirmação do utilizador — NÃO foi executada. ` +
            `Descreve em linguagem natural o que vais fazer (com os parâmetros principais) e pede ao utilizador para confirmar. ` +
            `Quando ele confirmar, a acção será executada.`,
          details: { toolName: name, args: parsed.data },
        },
      };
    }

    // Execução com try-catch defensivo
    let outcome: ToolExecutionResult<TResult>;
    try {
      outcome = (await tool.execute(parsed.data, ctx)) as ToolExecutionResult<TResult>;
    } catch (e) {
      this.logger.error(
        `Tool "${name}" rebentou: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );
      return {
        error: {
          code: 'EXECUTION_ERROR',
          message: `Erro ao executar "${name}". Tenta de novo ou ajusta os parâmetros.`,
        },
      };
    }

    // Audit — apenas para mutações (leitura é demasiado verbosa)
    if (tool.mutates) {
      await this.audit.log({
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: AuditAction.IA_QUERY,
        entityType: EntityType.AI_CONVERSATION,
        entityId: ctx.conversationId,
        afterData: {
          aiAgent: {
            toolName: name,
            messageId: ctx.messageId,
            argsHash: hashArgs(parsed.data),
            mutates: true,
          },
        },
      });
    }

    return outcome;
  }
}

/**
 * Hash leve dos args para audit — não armazenamos os args integrais
 * porque podem conter informação sensível. SHA-256 não vale a pena
 * aqui; uma fingerprint simples chega para correlacionar.
 */
function hashArgs(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return h.toString(16);
  } catch {
    return 'unhashable';
  }
}
