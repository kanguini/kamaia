/**
 * Kamaia AI — tipos de tool use.
 *
 * Toolkit minimal para registar capacidades agênticas que Claude pode
 * invocar. Cada tool:
 *  - Tem um nome único que é exposto a Claude
 *  - Define args validados via Zod (gera JSON Schema para o LLM)
 *  - Declara `requiredRoles` para RBAC (chave de segurança)
 *  - Recebe sempre `tenantId`/`userId` injectados do contexto da sessão,
 *    NUNCA do payload do LLM (defesa contra prompt injection com IDs
 *    de outros tenants)
 *  - Pode marcar `mutates=true` para acções destrutivas — a UI pode
 *    decidir pedir confirmação explícita ao utilizador antes de exec
 *  - Pode declarar `renderHint` para a UI saber como apresentar o
 *    resultado (lista clicável, abertura de detalhe, etc.)
 */
import { z } from 'zod';
import { Role } from '@prisma/client';

/**
 * Contexto da página onde o utilizador está. Enviado pelo frontend
 * a cada turn; o AgentService usa para enriquecer o system prompt.
 */
export type PageContext =
  | { type: 'home' }
  | { type: 'dashboard' }
  | { type: 'contratos.list'; search?: string; estado?: string }
  | { type: 'contratos.detail'; contratoId: string; numeroInterno?: string }
  | { type: 'contratos.novo' }
  | { type: 'entidades.list' }
  | { type: 'entidades.detail'; entidadeId: string }
  | { type: 'carteiras' }
  | { type: 'alertas' }
  | { type: 'compliance' }
  | { type: 'biblioteca'; section: 'templates' | 'clausulas' | 'tipos' }
  | { type: 'configuracoes' }
  | { type: 'ia.full' }
  | { type: 'other'; pathname: string };

/**
 * Contexto de execução injectado em cada tool call. tenantId/userId/
 * role NUNCA vêm do LLM — vêm da sessão autenticada.
 */
export interface ToolContext {
  tenantId: string;
  userId: string;
  role: Role;
  /** Página onde o user está, para tools sensíveis ao contexto. */
  pageContext?: PageContext;
  /** Conversation+message ids para audit trail. */
  conversationId: string;
  messageId: string;
  /**
   * Gate de confirmação humana ("o engine sugere, o humano confirma").
   * Tools `mutates:true` NÃO são executadas enquanto isto for falso —
   * o registry devolve CONFIRMATION_REQUIRED e o agente pede confirmação
   * ao utilizador. Fica `true` apenas no turn em que o utilizador
   * confirma explicitamente (frontend reenvia com este flag).
   */
  allowMutations?: boolean;
}

/**
 * Hint para a UI de como apresentar o `result`.
 *   - `text`: render apenas como texto plano da bolha do assistente
 *   - `list`: renderiza array de items como chips clicáveis
 *   - `contract`: abre detalhe do contrato no painel principal
 *   - `entity`: abre detalhe da entidade
 *   - `navigate`: faz routing (result tem `target` URL)
 *   - `confirmation`: pede ao utilizador para confirmar antes de
 *     persistir mutação (Sprint 1.4)
 */
export type RenderHint =
  | 'text'
  | 'list'
  | 'contract'
  | 'entity'
  | 'navigate'
  | 'confirmation';

/**
 * Resultado normalizado de uma tool. `result` é o que vai para Claude
 * via `tool_result`. `renderHint` + `uiPayload` são apenas para o
 * frontend; não vão a Claude (a UI lê-os do SSE event).
 */
export interface ToolExecutionResult<T = unknown> {
  /** Payload structured passado a Claude como tool_result. */
  result: T;
  /** Como o frontend deve renderizar. */
  renderHint?: RenderHint;
  /** Payload extra só para o frontend (não vai a Claude). */
  uiPayload?: unknown;
  /** Se houve erro de negócio (não excepção); Claude vê e adapta. */
  isError?: boolean;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  /** Nome único da tool. snake_case por convenção da Anthropic. */
  name: string;
  /** Descrição usada por Claude para decidir quando chamar. */
  description: string;
  /**
   * Schema Zod dos argumentos. Usamos `z.ZodTypeAny` para evitar
   * recursão excessiva de tipos quando o output do schema diverge
   * do input (e.g. `.default(...)` torna campos opcionais no input
   * mas obrigatórios no output).
   */
  schema: z.ZodTypeAny;
  /** Roles autorizadas. Vazio = qualquer role autenticada (raro). */
  requiredRoles: Role[];
  /** True para acções que mutam estado. UI pode pedir confirmação. */
  mutates: boolean;
  /**
   * Determina, a partir dos args validados, se ESTA invocação precisa
   * de confirmação humana. Por omissão é `mutates` (qualquer escrita
   * confirma). Tools cuja mutação é condicional aos args (ex.:
   * find_or_create só cria com `createIfMissing:true`) sobrepõem isto
   * para não gatear leituras puras.
   */
  needsConfirmation?: (args: TArgs) => boolean;
  /** Implementação. tenantId/userId vêm de ctx, NÃO de args. */
  execute(args: TArgs, ctx: ToolContext): Promise<ToolExecutionResult<TResult>>;
}

/**
 * Helper para definir tools com tipos inferidos.
 *
 * Uso:
 *   export const findContratos = defineTool({
 *     name: 'find_contratos',
 *     description: '...',
 *     schema: z.object({ ... }),
 *     requiredRoles: [Role.VIEWER, ...],
 *     mutates: false,
 *     execute: async (args, ctx) => { ... },
 *   })
 */
export function defineTool<TArgs, TResult = unknown>(
  def: ToolDefinition<TArgs, TResult>,
): ToolDefinition<TArgs, TResult> {
  return def;
}
