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
