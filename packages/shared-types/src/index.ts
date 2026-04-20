// ═══════════════════════════════════════════════════════════
// KAMAIA — Shared Types
// ═══════════════════════════════════════════════════════════

// ── Enums ─────────────────────────────────────────────────

export enum KamaiaRole {
  ADVOGADO_SOLO = 'ADVOGADO_SOLO',
  ADVOGADO_MEMBRO = 'ADVOGADO_MEMBRO',
  SOCIO_GESTOR = 'SOCIO_GESTOR',
  ESTAGIARIO = 'ESTAGIARIO',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  AI_QUERY = 'AI_QUERY',
  DOC_ANALYSIS = 'DOC_ANALYSIS',
  EXPORT = 'EXPORT',
}

export enum EntityType {
  USER = 'USER',
  GABINETE = 'GABINETE',
  CLIENTE = 'CLIENTE',
  PROCESSO = 'PROCESSO',
  PRAZO = 'PRAZO',
  CALENDAR_EVENT = 'CALENDAR_EVENT',
  DOCUMENT = 'DOCUMENT',
  AI_CONVERSATION = 'AI_CONVERSATION',
  SUBSCRIPTION = 'SUBSCRIPTION',
  TASK = 'TASK',
  TASK_COLUMN = 'TASK_COLUMN',
}

export enum ProcessoType {
  CIVEL = 'CIVEL',
  LABORAL = 'LABORAL',
  COMERCIAL = 'COMERCIAL',
  CRIMINAL = 'CRIMINAL',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  FAMILIA = 'FAMILIA',
  ARBITRAGEM = 'ARBITRAGEM',
}

export enum ProcessoStatus {
  ACTIVO = 'ACTIVO',
  SUSPENSO = 'SUSPENSO',
  ENCERRADO = 'ENCERRADO',
  ARQUIVADO = 'ARQUIVADO',
}

export enum PrazoType {
  CONTESTACAO = 'CONTESTACAO',
  RECURSO = 'RECURSO',
  RESPOSTA = 'RESPOSTA',
  ALEGACOES = 'ALEGACOES',
  AUDIENCIA = 'AUDIENCIA',
  OUTRO = 'OUTRO',
}

export enum PrazoStatus {
  PENDENTE = 'PENDENTE',
  CUMPRIDO = 'CUMPRIDO',
  EXPIRADO = 'EXPIRADO',
  CANCELADO = 'CANCELADO',
}

export enum ClienteType {
  INDIVIDUAL = 'INDIVIDUAL',
  EMPRESA = 'EMPRESA',
}

export enum ProcessoPriority {
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAIXA = 'BAIXA',
}

export enum ProcessoLifecycle {
  ATENDIMENTO = 'ATENDIMENTO',
  CONSULTA = 'CONSULTA',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  INSTRUCAO = 'INSTRUCAO',
  RECURSO = 'RECURSO',
  EXECUCAO = 'EXECUCAO',
  ARQUIVO = 'ARQUIVO',
  FINANCEIRO = 'FINANCEIRO',
}

export const LIFECYCLE_STAGES = [
  'ATENDIMENTO',
  'CONSULTA',
  'ADMINISTRATIVO',
  'INSTRUCAO',
  'RECURSO',
  'EXECUCAO',
  'ARQUIVO',
  'FINANCEIRO',
] as const;

export const LIFECYCLE_LABELS: Record<string, string> = {
  ATENDIMENTO: 'Atendimento',
  CONSULTA: 'Consulta',
  ADMINISTRATIVO: 'Administrativo',
  INSTRUCAO: 'Instrucao',
  RECURSO: 'Recurso',
  EXECUCAO: 'Execucao',
  ARQUIVO: 'Arquivo',
  FINANCEIRO: 'Financeiro',
};

export enum InteractionType {
  CHAMADA = 'CHAMADA',
  EMAIL = 'EMAIL',
  REUNIAO = 'REUNIAO',
  WHATSAPP = 'WHATSAPP',
  VISITA = 'VISITA',
}

export enum TaskPriority {
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAIXA = 'BAIXA',
}

export const DEFAULT_TASK_COLUMNS = [
  { title: 'A Fazer', color: '#3b82f6', position: 0 },
  { title: 'Em Progresso', color: '#f59e0b', position: 1 },
  { title: 'Concluido', color: '#10b981', position: 2 },
] as const;

export enum CalendarEventType {
  AUDIENCIA = 'AUDIENCIA',
  REUNIAO = 'REUNIAO',
  DILIGENCIA = 'DILIGENCIA',
  PRAZO = 'PRAZO',
  OUTRO = 'OUTRO',
}

export enum DocumentCategory {
  PETICAO = 'PETICAO',
  CONTRATO = 'CONTRATO',
  PROCURACAO = 'PROCURACAO',
  SENTENCA = 'SENTENCA',
  PARECER = 'PARECER',
  OUTRO = 'OUTRO',
}

export enum TimeEntryCategory {
  PESQUISA = 'PESQUISA',
  REDACCAO = 'REDACCAO',
  AUDIENCIA = 'AUDIENCIA',
  REUNIAO = 'REUNIAO',
  DESLOCACAO = 'DESLOCACAO',
  OUTRO = 'OUTRO',
}

export enum ExpenseCategory {
  EMOLUMENTOS = 'EMOLUMENTOS',
  DESLOCACAO = 'DESLOCACAO',
  COPIAS = 'COPIAS',
  HONORARIOS_PERITOS = 'HONORARIOS_PERITOS',
  OUTRO = 'OUTRO',
}

export enum LegislationCategory {
  CONSTITUCIONAL = 'CONSTITUCIONAL',
  CIVIL = 'CIVIL',
  LABORAL = 'LABORAL',
  COMERCIAL = 'COMERCIAL',
  PENAL = 'PENAL',
  PROCESSUAL = 'PROCESSUAL',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  SEGUROS = 'SEGUROS',
  OUTRO = 'OUTRO',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DRY_RUN = 'DRY_RUN',
}

export enum NotificationType {
  PRAZO_UPCOMING = 'PRAZO_UPCOMING',
  PRAZO_TODAY = 'PRAZO_TODAY',
  PRAZO_OVERDUE = 'PRAZO_OVERDUE',
  PRAZO_CRITICAL = 'PRAZO_CRITICAL',
  PROJECT_BUDGET_DRIFT = 'PROJECT_BUDGET_DRIFT',
  PROJECT_MILESTONE_OVERDUE = 'PROJECT_MILESTONE_OVERDUE',
  TEST = 'TEST',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO_INDIVIDUAL = 'PRO_INDIVIDUAL',
  PRO_BUSINESS = 'PRO_BUSINESS',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  TRIALING = 'TRIALING',
}

export enum ProcessoEventType {
  STAGE_CHANGE = 'STAGE_CHANGE',
  NOTE = 'NOTE',
  DOCUMENT_ADDED = 'DOCUMENT_ADDED',
  HEARING = 'HEARING',
  DEADLINE_SET = 'DEADLINE_SET',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

// ── Tramitação (Acto Processual) ──────────────────────────
// Autor do acto — segue o modelo do CPC angolano. "Nós" = o gabinete
// (nós praticámos o acto); "Ministério Público" separado da Contraparte
// porque em acções penais/públicas tem peso processual distinto.

export enum TramitacaoAutor {
  NOS = 'NOS',
  TRIBUNAL = 'TRIBUNAL',
  CONTRAPARTE = 'CONTRAPARTE',
  MINISTERIO_PUBLICO = 'MINISTERIO_PUBLICO',
  OUTRO = 'OUTRO',
}

export const TRAMITACAO_AUTOR_LABELS: Record<TramitacaoAutor, string> = {
  [TramitacaoAutor.NOS]: 'Nós',
  [TramitacaoAutor.TRIBUNAL]: 'Tribunal',
  [TramitacaoAutor.CONTRAPARTE]: 'Contraparte',
  [TramitacaoAutor.MINISTERIO_PUBLICO]: 'Ministério Público',
  [TramitacaoAutor.OUTRO]: 'Outro',
};

// Vocabulário controlado de tipos de acto. Baseado no CPC angolano e
// prática forense. Categoria agrupa-os visualmente no seletor UI.

export interface ActoTypeDefinition {
  key: string;
  label: string;
  category:
    | 'INICIAL'
    | 'COMUNICACAO'
    | 'ARTICULADOS'
    | 'DECISAO'
    | 'AUDIENCIA'
    | 'REQUERIMENTOS'
    | 'RECURSO'
    | 'EXECUCAO'
    | 'OUTRO';
}

export const TRAMITACAO_ACTO_TYPES: ActoTypeDefinition[] = [
  // INICIAL
  { key: 'peticao-inicial', label: 'Petição Inicial', category: 'INICIAL' },
  { key: 'distribuicao', label: 'Distribuição', category: 'INICIAL' },
  { key: 'citacao', label: 'Citação', category: 'INICIAL' },

  // COMUNICACAO
  { key: 'notificacao', label: 'Notificação', category: 'COMUNICACAO' },
  { key: 'carta-precatoria', label: 'Carta Precatória', category: 'COMUNICACAO' },

  // ARTICULADOS (arts. 467-508 CPC angolano)
  { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
  { key: 'reconvencao', label: 'Reconvenção', category: 'ARTICULADOS' },
  { key: 'replica', label: 'Réplica', category: 'ARTICULADOS' },
  { key: 'treplica', label: 'Tréplica', category: 'ARTICULADOS' },
  { key: 'articulado-superveniente', label: 'Articulado Superveniente', category: 'ARTICULADOS' },

  // DECISÕES
  { key: 'despacho-liminar', label: 'Despacho Liminar', category: 'DECISAO' },
  { key: 'despacho-saneador', label: 'Despacho Saneador', category: 'DECISAO' },
  { key: 'despacho', label: 'Despacho', category: 'DECISAO' },
  { key: 'sentenca', label: 'Sentença', category: 'DECISAO' },
  { key: 'acordao', label: 'Acórdão', category: 'DECISAO' },

  // AUDIÊNCIA
  { key: 'audiencia-previa', label: 'Audiência Prévia', category: 'AUDIENCIA' },
  { key: 'audiencia-julgamento', label: 'Audiência de Julgamento', category: 'AUDIENCIA' },
  { key: 'acta', label: 'Acta de Audiência', category: 'AUDIENCIA' },

  // REQUERIMENTOS
  { key: 'requerimento', label: 'Requerimento', category: 'REQUERIMENTOS' },
  { key: 'requerimento-probatorio', label: 'Requerimento Probatório', category: 'REQUERIMENTOS' },
  { key: 'junta-documento', label: 'Junção de Documento', category: 'REQUERIMENTOS' },

  // RECURSO (Lei 6/21)
  { key: 'recurso-apelacao', label: 'Recurso de Apelação', category: 'RECURSO' },
  { key: 'recurso-agravo', label: 'Recurso de Agravo', category: 'RECURSO' },
  { key: 'recurso-revista', label: 'Recurso de Revista', category: 'RECURSO' },

  // EXECUÇÃO
  { key: 'penhora', label: 'Penhora', category: 'EXECUCAO' },
  { key: 'embargo', label: 'Embargo', category: 'EXECUCAO' },

  // OUTRO
  { key: 'outro', label: 'Outro', category: 'OUTRO' },
];

export const TRAMITACAO_CATEGORY_LABELS: Record<ActoTypeDefinition['category'], string> = {
  INICIAL: 'Inicial',
  COMUNICACAO: 'Comunicação',
  ARTICULADOS: 'Articulados',
  DECISAO: 'Decisão',
  AUDIENCIA: 'Audiência',
  REQUERIMENTOS: 'Requerimentos',
  RECURSO: 'Recurso',
  EXECUCAO: 'Execução',
  OUTRO: 'Outro',
};

// Templates com automações embebidas — cobrem os actos mais recorrentes
// no dia-a-dia do gabinete. Entrada "Template" (≈ 10s): preenche tipo +
// autor + título e pode disparar criação de Prazo e avanço de fase.

export interface TramitacaoTemplate {
  key: string;
  label: string;           // nome no selector
  actoType: string;        // key de ActoTypeDefinition
  autor: TramitacaoAutor;
  defaultTitle: string;
  defaultDescription?: string;
  // Automação: ao registar, cria-se Prazo com estes parâmetros
  generatePrazo?: {
    type: string;          // PrazoType enum
    title: string;
    daysAfter: number;     // dias contínuos (UI converte em úteis se precisar)
    alertHoursBefore?: number;
  };
  // Automação: ao registar, avança processo para esta fase (key do WorkflowStage)
  advanceToStage?: string;
}

export const TRAMITACAO_TEMPLATES: TramitacaoTemplate[] = [
  {
    key: 'citacao-recebida',
    label: 'Citação recebida',
    actoType: 'citacao',
    autor: TramitacaoAutor.TRIBUNAL,
    defaultTitle: 'Citação recebida',
    generatePrazo: {
      type: 'CONTESTACAO',
      title: 'Contestar (20 dias CPC art. 486.º)',
      daysAfter: 20,
      alertHoursBefore: 72,
    },
    advanceToStage: 'citacao',
  },
  {
    key: 'contestacao-apresentada',
    label: 'Contestação apresentada',
    actoType: 'contestacao',
    autor: TramitacaoAutor.NOS,
    defaultTitle: 'Contestação apresentada',
    advanceToStage: 'contestacao',
  },
  {
    key: 'replica-contraparte',
    label: 'Réplica apresentada (contraparte)',
    actoType: 'replica',
    autor: TramitacaoAutor.CONTRAPARTE,
    defaultTitle: 'Réplica apresentada pela contraparte',
    generatePrazo: {
      type: 'RESPOSTA',
      title: 'Tréplica',
      daysAfter: 10,
      alertHoursBefore: 48,
    },
    advanceToStage: 'replica',
  },
  {
    key: 'despacho-saneador',
    label: 'Despacho saneador',
    actoType: 'despacho-saneador',
    autor: TramitacaoAutor.TRIBUNAL,
    defaultTitle: 'Despacho saneador proferido',
  },
  {
    key: 'sentenca-proferida',
    label: 'Sentença proferida',
    actoType: 'sentenca',
    autor: TramitacaoAutor.TRIBUNAL,
    defaultTitle: 'Sentença proferida',
    generatePrazo: {
      type: 'RECURSO',
      title: 'Recurso de apelação (Lei 6/21)',
      daysAfter: 30,
      alertHoursBefore: 72,
    },
    advanceToStage: 'sentenca',
  },
  {
    key: 'recurso-interposto',
    label: 'Recurso interposto',
    actoType: 'recurso-apelacao',
    autor: TramitacaoAutor.NOS,
    defaultTitle: 'Recurso de apelação interposto',
    advanceToStage: 'recurso',
  },
  {
    key: 'audiencia-agendada',
    label: 'Audiência agendada',
    actoType: 'audiencia-julgamento',
    autor: TramitacaoAutor.TRIBUNAL,
    defaultTitle: 'Audiência de julgamento agendada',
  },
];

// ── Audiência ─────────────────────────────────────────────
// Tipos alinhados ao CPC angolano. Audiência Prévia (art. 508.º-A)
// cumpre o saneamento oral; Julgamento produz prova. A "Produção
// Antecipada de Prova" cobre casos de testemunha fora do país ou
// doença grave (arts. 520.º e segs.).

export enum AudienciaType {
  AUDIENCIA_PREVIA = 'AUDIENCIA_PREVIA',
  JULGAMENTO = 'JULGAMENTO',
  DISCUSSAO_JULGAMENTO = 'DISCUSSAO_JULGAMENTO',
  PRODUCAO_ANTECIPADA_PROVA = 'PRODUCAO_ANTECIPADA_PROVA',
  TENTATIVA_CONCILIACAO = 'TENTATIVA_CONCILIACAO',
  INSTRUCAO = 'INSTRUCAO',
  INTERROGATORIO = 'INTERROGATORIO',
  OUTRA = 'OUTRA',
}

export const AUDIENCIA_TYPE_LABELS: Record<AudienciaType, string> = {
  [AudienciaType.AUDIENCIA_PREVIA]: 'Audiência Prévia',
  [AudienciaType.JULGAMENTO]: 'Julgamento',
  [AudienciaType.DISCUSSAO_JULGAMENTO]: 'Discussão e Julgamento',
  [AudienciaType.PRODUCAO_ANTECIPADA_PROVA]: 'Produção Antecipada de Prova',
  [AudienciaType.TENTATIVA_CONCILIACAO]: 'Tentativa de Conciliação',
  [AudienciaType.INSTRUCAO]: 'Instrução',
  [AudienciaType.INTERROGATORIO]: 'Interrogatório',
  [AudienciaType.OUTRA]: 'Outra',
};

// Ciclo de vida: AGENDADA → REALIZADA | ADIADA | CANCELADA.
// ADIADA cria uma nova Audiência linkada via previousId.

export enum AudienciaStatus {
  AGENDADA = 'AGENDADA',
  REALIZADA = 'REALIZADA',
  ADIADA = 'ADIADA',
  CANCELADA = 'CANCELADA',
}

export const AUDIENCIA_STATUS_LABELS: Record<AudienciaStatus, string> = {
  [AudienciaStatus.AGENDADA]: 'Agendada',
  [AudienciaStatus.REALIZADA]: 'Realizada',
  [AudienciaStatus.ADIADA]: 'Adiada',
  [AudienciaStatus.CANCELADA]: 'Cancelada',
};

// Máquina de estados soft. Regras:
// - AGENDADA: pode ser REALIZADA, ADIADA ou CANCELADA.
// - REALIZADA/ADIADA/CANCELADA: terminais (não transitam).
// O adiamento é tratado à parte: cria nova Audiência e marca a
// original como ADIADA num único fluxo transaccional.

export const AUDIENCIA_ALLOWED_TRANSITIONS: Record<AudienciaStatus, AudienciaStatus[]> = {
  [AudienciaStatus.AGENDADA]: [
    AudienciaStatus.REALIZADA,
    AudienciaStatus.ADIADA,
    AudienciaStatus.CANCELADA,
  ],
  [AudienciaStatus.REALIZADA]: [],
  [AudienciaStatus.ADIADA]: [],
  [AudienciaStatus.CANCELADA]: [],
};

// ── Result Type ───────────────────────────────────────────

export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E; code?: string };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = string>(error: E, code?: string): Result<never, E> {
  return { success: false, error, code };
}

// ── API Types ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

// ── JWT ───────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  gabineteId: string;
  role: KamaiaRole;
  email: string;
  iat?: number;
  exp?: number;
}

// ── Audit ─────────────────────────────────────────────────

export interface AuditLogEntry {
  action: AuditAction;
  entity: EntityType;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId: string;
  gabineteId: string;
  ip?: string;
  userAgent?: string;
}

// ── Plan Limits ───────────────────────────────────────────

export interface PlanLimits {
  processos: number; // -1 = unlimited
  clientes: number;
  aiQueries: number;
  docAnalyses: number;
  storageBytes: number;
  teamMembers: number;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE]: {
    processos: 5,
    clientes: 10,
    aiQueries: 10,
    docAnalyses: 0,
    storageBytes: 500 * 1024 * 1024, // 500 MB
    teamMembers: 1,
  },
  [SubscriptionPlan.PRO_INDIVIDUAL]: {
    processos: -1,
    clientes: -1,
    aiQueries: -1,
    docAnalyses: 20,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    teamMembers: 1,
  },
  [SubscriptionPlan.PRO_BUSINESS]: {
    processos: -1,
    clientes: -1,
    aiQueries: -1,
    docAnalyses: -1,
    storageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    teamMembers: 10,
  },
};

// ── Processo Stages ───────────────────────────────────────

export const PROCESSO_STAGES: Record<ProcessoType, string[]> = {
  [ProcessoType.CIVEL]: [
    'Peticao Inicial',
    'Citacao',
    'Contestacao',
    'Replica',
    'Audiencia Previa',
    'Instrucao',
    'Julgamento',
    'Sentenca',
    'Recurso',
    'Transito em Julgado',
  ],
  [ProcessoType.LABORAL]: [
    'Participacao',
    'Audiencia de Conciliacao',
    'Contestacao',
    'Instrucao',
    'Julgamento',
    'Sentenca',
    'Recurso',
    'Execucao',
  ],
  [ProcessoType.CRIMINAL]: [
    'Queixa / Participacao',
    'Inquerito',
    'Acusacao',
    'Instrucao',
    'Julgamento',
    'Sentenca',
    'Recurso',
  ],
  [ProcessoType.COMERCIAL]: [
    'Peticao',
    'Citacao',
    'Contestacao',
    'Instrucao',
    'Julgamento',
    'Sentenca',
  ],
  [ProcessoType.ADMINISTRATIVO]: [
    'Peticao',
    'Contestacao',
    'Instrucao',
    'Audiencia',
    'Decisao',
    'Recurso',
  ],
  [ProcessoType.FAMILIA]: [
    'Peticao',
    'Citacao',
    'Contestacao',
    'Mediacao',
    'Instrucao',
    'Julgamento',
    'Sentenca',
  ],
  [ProcessoType.ARBITRAGEM]: [
    'Requerimento',
    'Constituicao do Tribunal',
    'Instrucao',
    'Alegacoes',
    'Decisao',
  ],
};

// ── Workflow & Project primitives (Sprint 1+) ──────────────

export type WorkflowScope = 'PROCESSO' | 'PROJECT';

export type StageInstanceStatus = 'PENDENTE' | 'EM_CURSO' | 'CUMPRIDO' | 'SKIPPED';

export enum ProjectCategory {
  LITIGIO = 'LITIGIO',
  MA = 'MA',
  COMPLIANCE = 'COMPLIANCE',
  DUE_DILIGENCE = 'DUE_DILIGENCE',
  CONTRATO = 'CONTRATO',
  CONSULTORIA = 'CONSULTORIA',
  OUTRO = 'OUTRO',
}

export enum ProjectStatus {
  PROPOSTA = 'PROPOSTA',
  ACTIVO = 'ACTIVO',
  EM_PAUSA = 'EM_PAUSA',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
}

export enum ProjectHealth {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export enum RaciRole {
  RESPONSIBLE = 'RESPONSIBLE',
  ACCOUNTABLE = 'ACCOUNTABLE',
  CONSULTED = 'CONSULTED',
  INFORMED = 'INFORMED',
}

/**
 * Richer stage templates — seeded as the default Workflow for each
 * ProcessoType when a gabinete is provisioned. The UI reads from the
 * DB (Workflow/WorkflowStage) so firms can extend/edit freely.
 */
export interface StageTemplate {
  key: string;
  label: string;
  category?: string;
  allowsParallel?: boolean;
  isTerminal?: boolean;
}

export const PROCESSO_STAGE_TEMPLATES: Record<ProcessoType, StageTemplate[]> = {
  [ProcessoType.CIVEL]: [
    { key: 'peticao-inicial', label: 'Petição Inicial', category: 'INICIAL' },
    { key: 'citacao', label: 'Citação', category: 'INICIAL' },
    { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
    { key: 'replica', label: 'Réplica', category: 'ARTICULADOS' },
    { key: 'treplica', label: 'Tréplica', category: 'ARTICULADOS' },
    { key: 'articulados-supervenientes', label: 'Articulados Supervenientes', category: 'ARTICULADOS', allowsParallel: true },
    { key: 'incidente', label: 'Incidente', category: 'PARALELO', allowsParallel: true },
    { key: 'audiencia-previa', label: 'Audiência Prévia', category: 'JULGAMENTO' },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'julgamento', label: 'Julgamento', category: 'JULGAMENTO' },
    { key: 'sentenca', label: 'Sentença', category: 'DECISAO' },
    { key: 'recurso', label: 'Recurso', category: 'RECURSO', allowsParallel: true },
    { key: 'transito-julgado', label: 'Trânsito em Julgado', category: 'FINAL', isTerminal: true },
  ],
  [ProcessoType.LABORAL]: [
    { key: 'participacao', label: 'Participação', category: 'INICIAL' },
    { key: 'audiencia-conciliacao', label: 'Audiência de Conciliação', category: 'INICIAL' },
    { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
    { key: 'replica', label: 'Réplica', category: 'ARTICULADOS' },
    { key: 'treplica', label: 'Tréplica', category: 'ARTICULADOS' },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'julgamento', label: 'Julgamento', category: 'JULGAMENTO' },
    { key: 'sentenca', label: 'Sentença', category: 'DECISAO' },
    { key: 'recurso', label: 'Recurso', category: 'RECURSO', allowsParallel: true },
    { key: 'execucao', label: 'Execução', category: 'FINAL', isTerminal: true },
  ],
  [ProcessoType.CRIMINAL]: [
    { key: 'queixa', label: 'Queixa / Participação', category: 'INICIAL' },
    { key: 'inquerito', label: 'Inquérito', category: 'INICIAL' },
    { key: 'acusacao', label: 'Acusação', category: 'ARTICULADOS' },
    { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'julgamento', label: 'Julgamento', category: 'JULGAMENTO' },
    { key: 'sentenca', label: 'Sentença', category: 'DECISAO' },
    { key: 'recurso', label: 'Recurso', category: 'RECURSO', allowsParallel: true },
  ],
  [ProcessoType.COMERCIAL]: [
    { key: 'peticao', label: 'Petição', category: 'INICIAL' },
    { key: 'citacao', label: 'Citação', category: 'INICIAL' },
    { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
    { key: 'replica', label: 'Réplica', category: 'ARTICULADOS' },
    { key: 'treplica', label: 'Tréplica', category: 'ARTICULADOS' },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'julgamento', label: 'Julgamento', category: 'JULGAMENTO' },
    { key: 'sentenca', label: 'Sentença', category: 'DECISAO' },
  ],
  [ProcessoType.ADMINISTRATIVO]: [
    { key: 'peticao', label: 'Petição', category: 'INICIAL' },
    { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
    { key: 'replica', label: 'Réplica', category: 'ARTICULADOS' },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'audiencia', label: 'Audiência', category: 'JULGAMENTO' },
    { key: 'decisao', label: 'Decisão', category: 'DECISAO' },
    { key: 'recurso', label: 'Recurso', category: 'RECURSO', allowsParallel: true },
  ],
  [ProcessoType.FAMILIA]: [
    { key: 'peticao', label: 'Petição', category: 'INICIAL' },
    { key: 'citacao', label: 'Citação', category: 'INICIAL' },
    { key: 'contestacao', label: 'Contestação', category: 'ARTICULADOS' },
    { key: 'mediacao', label: 'Mediação', category: 'PARALELO', allowsParallel: true },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'julgamento', label: 'Julgamento', category: 'JULGAMENTO' },
    { key: 'sentenca', label: 'Sentença', category: 'DECISAO' },
  ],
  [ProcessoType.ARBITRAGEM]: [
    { key: 'requerimento', label: 'Requerimento', category: 'INICIAL' },
    { key: 'constituicao-tribunal', label: 'Constituição do Tribunal', category: 'INICIAL' },
    { key: 'instrucao', label: 'Instrução', category: 'JULGAMENTO' },
    { key: 'alegacoes', label: 'Alegações', category: 'JULGAMENTO' },
    { key: 'decisao', label: 'Decisão', category: 'DECISAO', isTerminal: true },
  ],
};

/**
 * Project templates — seeded once per gabinete so users can spin up
 * non-litigation engagements (M&A, Compliance, DD) with standard stages.
 */
export const PROJECT_STAGE_TEMPLATES: Record<ProjectCategory, StageTemplate[]> = {
  [ProjectCategory.LITIGIO]: [
    { key: 'analise', label: 'Análise' },
    { key: 'propositura', label: 'Propositura' },
    { key: 'em-curso', label: 'Em Curso' },
    { key: 'encerrado', label: 'Encerrado', isTerminal: true },
  ],
  [ProjectCategory.MA]: [
    { key: 'nda', label: 'NDA' },
    { key: 'term-sheet', label: 'Term Sheet' },
    { key: 'due-diligence', label: 'Due Diligence' },
    { key: 'spa', label: 'SPA' },
    { key: 'signing', label: 'Signing' },
    { key: 'closing', label: 'Closing', isTerminal: true },
    { key: 'post-closing', label: 'Pós-Closing', allowsParallel: true },
  ],
  [ProjectCategory.COMPLIANCE]: [
    { key: 'assessment', label: 'Assessment' },
    { key: 'gap-analysis', label: 'Gap Analysis' },
    { key: 'policies', label: 'Políticas' },
    { key: 'training', label: 'Formação' },
    { key: 'monitoring', label: 'Monitorização' },
    { key: 'report', label: 'Relatório', isTerminal: true },
  ],
  [ProjectCategory.DUE_DILIGENCE]: [
    { key: 'kickoff', label: 'Kick-off' },
    { key: 'data-room', label: 'Data Room' },
    { key: 'revisao', label: 'Revisão' },
    { key: 'red-flags', label: 'Red Flags' },
    { key: 'relatorio', label: 'Relatório Final', isTerminal: true },
  ],
  [ProjectCategory.CONTRATO]: [
    { key: 'term-sheet', label: 'Term Sheet' },
    { key: 'primeiro-draft', label: '1º Draft' },
    { key: 'negociacao', label: 'Negociação' },
    { key: 'aprovacao', label: 'Aprovação' },
    { key: 'assinatura', label: 'Assinatura', isTerminal: true },
  ],
  [ProjectCategory.CONSULTORIA]: [
    { key: 'briefing', label: 'Briefing' },
    { key: 'pesquisa', label: 'Pesquisa' },
    { key: 'draft', label: 'Draft' },
    { key: 'entrega', label: 'Entrega', isTerminal: true },
  ],
  [ProjectCategory.OUTRO]: [
    { key: 'por-iniciar', label: 'Por Iniciar' },
    { key: 'em-curso', label: 'Em Curso' },
    { key: 'concluido', label: 'Concluído', isTerminal: true },
  ],
};

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  [ProjectCategory.LITIGIO]: 'Litígio',
  [ProjectCategory.MA]: 'Fusões & Aquisições',
  [ProjectCategory.COMPLIANCE]: 'Compliance',
  [ProjectCategory.DUE_DILIGENCE]: 'Due Diligence',
  [ProjectCategory.CONTRATO]: 'Contrato',
  [ProjectCategory.CONSULTORIA]: 'Consultoria',
  [ProjectCategory.OUTRO]: 'Outro',
};

// ── Project Templates (playbooks) ─────────────────────────
//
// A template expresses a full engagement blueprint: category, scope blurb,
// typical duration, and a list of milestones with DAY OFFSETS from the
// project start (day 0). Users pick a template, provide a name + start date,
// and the backend materialises everything in one transaction.

export interface MilestoneTemplate {
  title: string;
  description?: string;
  /** Offset in days from the project start (inclusive). */
  startDayOffset: number;
  /** Offset in days for the milestone deadline. */
  dueDayOffset: number;
}

export interface ProjectTemplate {
  id: string;
  category: ProjectCategory;
  name: string;
  description: string;
  scopeBlurb: string;
  objectivesBlurb?: string;
  /** Default total duration in days — used when end date isn't provided. */
  defaultDurationDays: number;
  milestones: MilestoneTemplate[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'ma-standard',
    category: ProjectCategory.MA,
    name: 'Fusão & Aquisição (standard)',
    description:
      'Operação de M&A completa: NDA → Term Sheet → DD → SPA → Signing → Closing.',
    scopeBlurb:
      'Assessoria jurídica na operação de aquisição, incluindo DD legal, negociação contratual e closing.',
    objectivesBlurb:
      'Concluir a operação no prazo acordado, minimizando riscos legais e fiscais.',
    defaultDurationDays: 180,
    milestones: [
      { title: 'NDA assinado', startDayOffset: 0, dueDayOffset: 7 },
      { title: 'Term Sheet acordado', startDayOffset: 7, dueDayOffset: 21 },
      { title: 'DD kickoff', startDayOffset: 21, dueDayOffset: 30 },
      { title: 'Red flags report', startDayOffset: 30, dueDayOffset: 60 },
      { title: 'SPA draft', startDayOffset: 60, dueDayOffset: 75 },
      { title: 'Signing', startDayOffset: 75, dueDayOffset: 90 },
      { title: 'Closing', startDayOffset: 90, dueDayOffset: 120 },
      { title: 'Integração pós-closing', startDayOffset: 120, dueDayOffset: 180 },
    ],
  },
  {
    id: 'compliance-programme',
    category: ProjectCategory.COMPLIANCE,
    name: 'Programa de Compliance',
    description:
      'Implementação de programa de compliance do zero: assessment, gap analysis, políticas, formação e monitorização.',
    scopeBlurb:
      'Desenho e implementação de programa de compliance adaptado à realidade da empresa, alinhado com o quadro regulatório angolano.',
    objectivesBlurb:
      'Estabelecer controlos internos robustos e cultura de conformidade.',
    defaultDurationDays: 180,
    milestones: [
      { title: 'Assessment inicial', startDayOffset: 0, dueDayOffset: 14 },
      { title: 'Gap analysis report', startDayOffset: 14, dueDayOffset: 30 },
      { title: 'Draft políticas', startDayOffset: 30, dueDayOffset: 60 },
      { title: 'Board approval', startDayOffset: 60, dueDayOffset: 75 },
      { title: 'Training rollout', startDayOffset: 75, dueDayOffset: 105 },
      { title: 'Primeiro monitoring report', startDayOffset: 105, dueDayOffset: 180 },
    ],
  },
  {
    id: 'due-diligence-legal',
    category: ProjectCategory.DUE_DILIGENCE,
    name: 'Due Diligence Legal',
    description:
      'DD legal padrão: kickoff, data room, revisão, red flags, relatório final.',
    scopeBlurb:
      'Revisão legal completa da empresa-alvo, identificação de red flags e emissão de relatório.',
    defaultDurationDays: 30,
    milestones: [
      { title: 'Kickoff + requerimento de documentos', startDayOffset: 0, dueDayOffset: 3 },
      { title: 'Data room aberto', startDayOffset: 3, dueDayOffset: 7 },
      { title: 'Revisão legal completa', startDayOffset: 7, dueDayOffset: 21 },
      { title: 'Red flags identificados', startDayOffset: 21, dueDayOffset: 28 },
      { title: 'Relatório final', startDayOffset: 28, dueDayOffset: 30 },
    ],
  },
  {
    id: 'contract-complex',
    category: ProjectCategory.CONTRATO,
    name: 'Contrato Complexo (negociação)',
    description:
      'Contrato com múltiplas rondas de negociação: term sheet, drafts, negociação, aprovação, assinatura.',
    scopeBlurb:
      'Redacção e negociação de contrato complexo, incluindo term sheet, drafts sucessivos e assinatura.',
    defaultDurationDays: 45,
    milestones: [
      { title: 'Term Sheet', startDayOffset: 0, dueDayOffset: 7 },
      { title: '1º Draft', startDayOffset: 7, dueDayOffset: 14 },
      { title: 'Ronda 1 de negociação', startDayOffset: 14, dueDayOffset: 21 },
      { title: 'Final draft', startDayOffset: 21, dueDayOffset: 35 },
      { title: 'Assinatura', startDayOffset: 35, dueDayOffset: 45 },
    ],
  },
  {
    id: 'consultoria-parecer',
    category: ProjectCategory.CONSULTORIA,
    name: 'Consultoria / Parecer jurídico',
    description:
      'Emissão de parecer jurídico: briefing, pesquisa, drafting, entrega.',
    scopeBlurb:
      'Análise jurídica e emissão de parecer sobre a matéria solicitada.',
    defaultDurationDays: 21,
    milestones: [
      { title: 'Briefing com o cliente', startDayOffset: 0, dueDayOffset: 3 },
      { title: 'Pesquisa legal completa', startDayOffset: 3, dueDayOffset: 10 },
      { title: 'Draft preliminar', startDayOffset: 10, dueDayOffset: 14 },
      { title: 'Draft final + entrega', startDayOffset: 14, dueDayOffset: 21 },
    ],
  },
];

/** Finds a template by id, returning undefined when not in the catalog. */
export function findProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
