// ═══════════════════════════════════════════════════════════
// KAMAIA CLM — Shared Types
// Contract Lifecycle Management for Angola & PALOP
// ═══════════════════════════════════════════════════════════

// ─── ROLES ────────────────────────────────────────────────

export enum Role {
  ADMIN = 'ADMIN',
  LEGAL_LEAD = 'LEGAL_LEAD',
  CONTRACT_MANAGER = 'CONTRACT_MANAGER',
  BUSINESS_USER = 'BUSINESS_USER',
  VIEWER = 'VIEWER',
  EXTERNAL = 'EXTERNAL',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.LEGAL_LEAD]: 'Responsável Jurídico',
  [Role.CONTRACT_MANAGER]: 'Contract Manager',
  [Role.BUSINESS_USER]: 'Utilizador de Negócio',
  [Role.VIEWER]: 'Visualizador',
  [Role.EXTERNAL]: 'Colaborador Externo',
};

// ─── TENANT ───────────────────────────────────────────────

export enum TenantPlan {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  SCALE = 'SCALE',
  ENTERPRISE = 'ENTERPRISE',
  AGENCY = 'AGENCY',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TRIAL = 'TRIAL',
  CANCELLED = 'CANCELLED',
}

// ─── ENTIDADE ─────────────────────────────────────────────

export enum EntidadeTipo {
  PESSOA_SINGULAR = 'PESSOA_SINGULAR',
  PESSOA_COLECTIVA = 'PESSOA_COLECTIVA',
}

export enum EntidadeNacionalidadeCambial {
  RESIDENTE = 'RESIDENTE',
  NAO_RESIDENTE = 'NAO_RESIDENTE',
}

// ─── CONTRATO — Estados + Origem ──────────────────────────

export enum ContratoEstado {
  INTAKE = 'INTAKE',
  DRAFTING = 'DRAFTING',
  REV_INTERNA = 'REV_INTERNA',
  REV_CLIENTE = 'REV_CLIENTE',
  EM_NEGOCIACAO = 'EM_NEGOCIACAO',
  APROVACAO = 'APROVACAO',
  PRONTO_ASSINATURA = 'PRONTO_ASSINATURA',
  ASSINADO = 'ASSINADO',
  POS_ASSINATURA = 'POS_ASSINATURA',
  ACTIVO = 'ACTIVO',
  EM_DISPUTA = 'EM_DISPUTA',
  EM_ADENDA = 'EM_ADENDA',
  EM_TERMINACAO = 'EM_TERMINACAO',
  TERMINADO = 'TERMINADO',
  ARQUIVADO = 'ARQUIVADO',
  REPOSITORIO = 'REPOSITORIO',
  CANCELADO = 'CANCELADO',
}

export const CONTRATO_ESTADO_LABELS: Record<ContratoEstado, string> = {
  [ContratoEstado.INTAKE]: 'Solicitação',
  [ContratoEstado.DRAFTING]: 'Redacção',
  [ContratoEstado.REV_INTERNA]: 'Revisão interna',
  [ContratoEstado.REV_CLIENTE]: 'Revisão pelo cliente',
  [ContratoEstado.EM_NEGOCIACAO]: 'Em negociação',
  [ContratoEstado.APROVACAO]: 'Aprovação final',
  [ContratoEstado.PRONTO_ASSINATURA]: 'Pronto para assinatura',
  [ContratoEstado.ASSINADO]: 'Assinado',
  [ContratoEstado.POS_ASSINATURA]: 'Pós-assinatura (registos)',
  [ContratoEstado.ACTIVO]: 'Activo',
  [ContratoEstado.EM_DISPUTA]: 'Em disputa',
  [ContratoEstado.EM_ADENDA]: 'Em adenda',
  [ContratoEstado.EM_TERMINACAO]: 'Em terminação',
  [ContratoEstado.TERMINADO]: 'Terminado',
  [ContratoEstado.ARQUIVADO]: 'Arquivado',
  [ContratoEstado.REPOSITORIO]: 'Repositório',
  [ContratoEstado.CANCELADO]: 'Cancelado',
};

export enum ContratoOrigem {
  CRIADO_INTERNAMENTE = 'CRIADO_INTERNAMENTE',
  IMPORTADO_REPOSITORIO = 'IMPORTADO_REPOSITORIO',
  RECEBIDO_CONTRAPARTE = 'RECEBIDO_CONTRAPARTE',
  ADENDA = 'ADENDA',
}

// ─── State Machine ────────────────────────────────────────
//
// Regras:
// - Loops permitidos em EM_NEGOCIACAO e REV_INTERNA
// - REPOSITORIO entra directo em ACTIVO via importação em massa
// - CANCELADO é absorvedor a partir de qualquer estado pré-ASSINADO

export const CONTRATO_TRANSITIONS: Record<ContratoEstado, ContratoEstado[]> = {
  [ContratoEstado.INTAKE]: [
    ContratoEstado.DRAFTING,
    ContratoEstado.EM_NEGOCIACAO,  // modo B salta drafting
    ContratoEstado.REPOSITORIO,    // modo C
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.DRAFTING]: [
    ContratoEstado.REV_INTERNA,
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.REV_INTERNA]: [
    ContratoEstado.DRAFTING,        // loop com júnior
    ContratoEstado.REV_CLIENTE,
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.REV_CLIENTE]: [
    ContratoEstado.DRAFTING,        // cliente exige mudanças
    ContratoEstado.EM_NEGOCIACAO,   // enviar à contraparte
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.EM_NEGOCIACAO]: [
    ContratoEstado.EM_NEGOCIACAO,   // auto-loop em nova versão
    ContratoEstado.REV_CLIENTE,      // voltar a cliente
    ContratoEstado.APROVACAO,
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.APROVACAO]: [
    ContratoEstado.EM_NEGOCIACAO,
    ContratoEstado.PRONTO_ASSINATURA,
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.PRONTO_ASSINATURA]: [
    ContratoEstado.ASSINADO,
    ContratoEstado.APROVACAO,
    ContratoEstado.CANCELADO,
  ],
  [ContratoEstado.ASSINADO]: [
    ContratoEstado.POS_ASSINATURA,
  ],
  [ContratoEstado.POS_ASSINATURA]: [
    ContratoEstado.ACTIVO,
  ],
  [ContratoEstado.ACTIVO]: [
    ContratoEstado.EM_DISPUTA,
    ContratoEstado.EM_ADENDA,
    ContratoEstado.EM_TERMINACAO,
    ContratoEstado.ACTIVO,           // renovação auto re-entra
  ],
  [ContratoEstado.EM_DISPUTA]: [
    ContratoEstado.ACTIVO,
    ContratoEstado.EM_TERMINACAO,
  ],
  [ContratoEstado.EM_ADENDA]: [
    ContratoEstado.ACTIVO,
  ],
  [ContratoEstado.EM_TERMINACAO]: [
    ContratoEstado.TERMINADO,
  ],
  [ContratoEstado.TERMINADO]: [
    ContratoEstado.ARQUIVADO,
  ],
  [ContratoEstado.ARQUIVADO]: [],
  [ContratoEstado.REPOSITORIO]: [
    ContratoEstado.ACTIVO,
    ContratoEstado.ARQUIVADO,
  ],
  [ContratoEstado.CANCELADO]: [],
};

export function canTransition(from: ContratoEstado, to: ContratoEstado): boolean {
  return CONTRATO_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Categorias de TipoContrato ───────────────────────────

export enum TipoContratoCategoria {
  PRE_CONTRATO = 'PRE_CONTRATO',
  SERVICOS = 'SERVICOS',
  BENS = 'BENS',
  IMOBILIARIO = 'IMOBILIARIO',
  FINANCEIRO = 'FINANCEIRO',
  TRABALHO = 'TRABALHO',
  IP = 'IP',
  OUTRO = 'OUTRO',
}

export const TIPO_CONTRATO_CATEGORIA_LABELS: Record<TipoContratoCategoria, string> = {
  [TipoContratoCategoria.PRE_CONTRATO]: 'Pré-contrato',
  [TipoContratoCategoria.SERVICOS]: 'Serviços',
  [TipoContratoCategoria.BENS]: 'Bens',
  [TipoContratoCategoria.IMOBILIARIO]: 'Imobiliário',
  [TipoContratoCategoria.FINANCEIRO]: 'Financeiro',
  [TipoContratoCategoria.TRABALHO]: 'Trabalho',
  [TipoContratoCategoria.IP]: 'Propriedade Intelectual',
  [TipoContratoCategoria.OUTRO]: 'Outro',
};

// ─── Versão (Direccão) ───────────────────────────────────

export enum VersaoDireccao {
  INTERNA = 'INTERNA',
  ENVIADO_CLIENTE = 'ENVIADO_CLIENTE',
  RECEBIDO_CLIENTE = 'RECEBIDO_CLIENTE',
  ENVIADO_CONTRAPARTE = 'ENVIADO_CONTRAPARTE',
  RECEBIDO_CONTRAPARTE = 'RECEBIDO_CONTRAPARTE',
  ASSINADO_FINAL = 'ASSINADO_FINAL',
}

// ─── Colaboração externa (EXTERNAL role scoped) ──────────

export enum ColaboradorTipoAcesso {
  LEITURA = 'LEITURA',
  COMENTARIO = 'COMENTARIO',
  ASSINATURA = 'ASSINATURA',
}

export const COLABORADOR_TIPO_ACESSO_LABELS: Record<ColaboradorTipoAcesso, string> = {
  [ColaboradorTipoAcesso.LEITURA]: 'Apenas leitura',
  [ColaboradorTipoAcesso.COMENTARIO]: 'Pode comentar',
  [ColaboradorTipoAcesso.ASSINATURA]: 'Pode assinar',
};

export enum ColaboradorEstado {
  PENDENTE = 'PENDENTE',
  ACTIVO = 'ACTIVO',
  REVOGADO = 'REVOGADO',
  EXPIRADO = 'EXPIRADO',
}

export enum ComentarioAutorTipo {
  USER = 'USER',
  COLABORADOR = 'COLABORADOR',
}

export enum AssinaturaMetodo {
  DESENHADA_BROWSER = 'DESENHADA_BROWSER',
  MANUSCRITA_DIGITALIZADA = 'MANUSCRITA_DIGITALIZADA',
  CERTIFICADO_DIGITAL = 'CERTIFICADO_DIGITAL',
  PIN_SMS = 'PIN_SMS',
}

export const ASSINATURA_METODO_LABELS: Record<AssinaturaMetodo, string> = {
  [AssinaturaMetodo.DESENHADA_BROWSER]: 'Desenhada no browser',
  [AssinaturaMetodo.MANUSCRITA_DIGITALIZADA]: 'Manuscrita digitalizada',
  [AssinaturaMetodo.CERTIFICADO_DIGITAL]: 'Certificado digital qualificado',
  [AssinaturaMetodo.PIN_SMS]: 'PIN via SMS',
};

export enum AssinaturaEstado {
  PENDENTE = 'PENDENTE',
  ASSINADA = 'ASSINADA',
  REJEITADA = 'REJEITADA',
  REVOGADA = 'REVOGADA',
}

// ─── Parte (Papel) ────────────────────────────────────────

export enum PartePapel {
  PARTE_PRINCIPAL = 'PARTE_PRINCIPAL',
  CONTRAPARTE = 'CONTRAPARTE',
  GARANTE = 'GARANTE',
  TESTEMUNHA = 'TESTEMUNHA',
  NOTARIO = 'NOTARIO',
  INTERVENIENTE_ACESSORIO = 'INTERVENIENTE_ACESSORIO',
}

// ─── Data-chave ────────────────────────────────────────────

export enum DataChaveTipo {
  ASSINATURA = 'ASSINATURA',
  INICIO_VIGENCIA = 'INICIO_VIGENCIA',
  TERMO = 'TERMO',
  RENOVACAO_AUTOMATICA = 'RENOVACAO_AUTOMATICA',
  JANELA_DENUNCIA_INICIO = 'JANELA_DENUNCIA_INICIO',
  JANELA_DENUNCIA_FIM = 'JANELA_DENUNCIA_FIM',
  PAGAMENTO = 'PAGAMENTO',
  ENTREGA = 'ENTREGA',
  REVISAO_PRECO = 'REVISAO_PRECO',
  MILESTONE = 'MILESTONE',
  GARANTIA_VALIDADE = 'GARANTIA_VALIDADE',
  SEGURO_VALIDADE = 'SEGURO_VALIDADE',
  OUTRO = 'OUTRO',
}

export const DATA_CHAVE_TIPO_LABELS: Record<DataChaveTipo, string> = {
  [DataChaveTipo.ASSINATURA]: 'Assinatura',
  [DataChaveTipo.INICIO_VIGENCIA]: 'Início de vigência',
  [DataChaveTipo.TERMO]: 'Termo',
  [DataChaveTipo.RENOVACAO_AUTOMATICA]: 'Renovação automática',
  [DataChaveTipo.JANELA_DENUNCIA_INICIO]: 'Início janela de denúncia',
  [DataChaveTipo.JANELA_DENUNCIA_FIM]: 'Fim janela de denúncia',
  [DataChaveTipo.PAGAMENTO]: 'Pagamento',
  [DataChaveTipo.ENTREGA]: 'Entrega',
  [DataChaveTipo.REVISAO_PRECO]: 'Revisão de preço',
  [DataChaveTipo.MILESTONE]: 'Milestone',
  [DataChaveTipo.GARANTIA_VALIDADE]: 'Validade de garantia',
  [DataChaveTipo.SEGURO_VALIDADE]: 'Validade de seguro',
  [DataChaveTipo.OUTRO]: 'Outro',
};

// ─── Obrigação ────────────────────────────────────────────

export enum ObrigacaoTipo {
  PAGAMENTO_PERIODICO = 'PAGAMENTO_PERIODICO',
  REPORTE = 'REPORTE',
  GARANTIA_VALIDADE = 'GARANTIA_VALIDADE',
  SEGURO_VALIDADE = 'SEGURO_VALIDADE',
  SLA = 'SLA',
  ENTREGA_PERIODICA = 'ENTREGA_PERIODICA',
  OUTRO = 'OUTRO',
}

export enum ObrigacaoPeriodicidade {
  UNICA = 'UNICA',
  MENSAL = 'MENSAL',
  BIMESTRAL = 'BIMESTRAL',
  TRIMESTRAL = 'TRIMESTRAL',
  SEMESTRAL = 'SEMESTRAL',
  ANUAL = 'ANUAL',
}

export enum ObrigacaoInstanciaEstado {
  PENDENTE = 'PENDENTE',
  CUMPRIDA = 'CUMPRIDA',
  ATRASADA = 'ATRASADA',
  DISPENSADA = 'DISPENSADA',
}

// ─── Acto Regulatório (compliance angolano) ───────────────

export enum ActoRegulatorioTipo {
  IMPOSTO_SELO = 'IMPOSTO_SELO',
  REGISTO_COMERCIAL = 'REGISTO_COMERCIAL',
  REGISTO_PREDIAL = 'REGISTO_PREDIAL',
  REGISTO_AUTOMOVEL = 'REGISTO_AUTOMOVEL',
  REGISTO_IP_IAPI = 'REGISTO_IP_IAPI',
  BNA_AUTORIZACAO = 'BNA_AUTORIZACAO',
  BNA_REGISTO = 'BNA_REGISTO',
  AGT_RETENCAO_IRT = 'AGT_RETENCAO_IRT',
  AGT_OUTRO = 'AGT_OUTRO',
  RECONHECIMENTO_NOTARIAL = 'RECONHECIMENTO_NOTARIAL',
  TRADUCAO_JURAMENTADA = 'TRADUCAO_JURAMENTADA',
  SECTORIAL_OUTRO = 'SECTORIAL_OUTRO',
}

export const ACTO_REGULATORIO_LABELS: Record<ActoRegulatorioTipo, string> = {
  [ActoRegulatorioTipo.IMPOSTO_SELO]: 'Imposto de Selo',
  [ActoRegulatorioTipo.REGISTO_COMERCIAL]: 'Registo Comercial',
  [ActoRegulatorioTipo.REGISTO_PREDIAL]: 'Registo Predial',
  [ActoRegulatorioTipo.REGISTO_AUTOMOVEL]: 'Registo Automóvel',
  [ActoRegulatorioTipo.REGISTO_IP_IAPI]: 'Registo IAPI',
  [ActoRegulatorioTipo.BNA_AUTORIZACAO]: 'Autorização BNA',
  [ActoRegulatorioTipo.BNA_REGISTO]: 'Registo BNA',
  [ActoRegulatorioTipo.AGT_RETENCAO_IRT]: 'Retenção IRT (AGT)',
  [ActoRegulatorioTipo.AGT_OUTRO]: 'Outro acto AGT',
  [ActoRegulatorioTipo.RECONHECIMENTO_NOTARIAL]: 'Reconhecimento notarial',
  [ActoRegulatorioTipo.TRADUCAO_JURAMENTADA]: 'Tradução juramentada',
  [ActoRegulatorioTipo.SECTORIAL_OUTRO]: 'Outro sectorial',
};

export enum ActoEstado {
  NAO_APLICAVEL = 'NAO_APLICAVEL',
  PENDENTE = 'PENDENTE',
  EM_CURSO = 'EM_CURSO',
  CONCLUIDO = 'CONCLUIDO',
  DISPENSADO = 'DISPENSADO',
  FALHOU = 'FALHOU',
  EXPIRADO = 'EXPIRADO',
}

// ─── Negociação ───────────────────────────────────────────

export enum NegociacaoPontoEstado {
  ABERTO = 'ABERTO',
  PROPOSTO = 'PROPOSTO',
  CONTRA_PROPOSTO = 'CONTRA_PROPOSTO',
  ACEITE = 'ACEITE',
  REJEITADO = 'REJEITADO',
  RETIRADO = 'RETIRADO',
}

export enum NegociacaoPontoCriticidade {
  BAIXA = 'BAIXA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  CRITICA = 'CRITICA',
}

// ─── Terminação ───────────────────────────────────────────

export enum TerminacaoTipo {
  NATURAL = 'NATURAL',
  DENUNCIA_TEMPESTIVA = 'DENUNCIA_TEMPESTIVA',
  RESOLUCAO_INCUMPRIMENTO = 'RESOLUCAO_INCUMPRIMENTO',
  REVOGACAO_MUTUA = 'REVOGACAO_MUTUA',
  FORCA_MAIOR = 'FORCA_MAIOR',
  CADUCIDADE = 'CADUCIDADE',
  OUTRO = 'OUTRO',
}

// ─── Importação em lote ───────────────────────────────────

export enum LoteEstado {
  EM_FILA = 'EM_FILA',
  PROCESSANDO = 'PROCESSANDO',
  CONCLUIDO = 'CONCLUIDO',
  CONCLUIDO_COM_ERROS = 'CONCLUIDO_COM_ERROS',
  FALHOU = 'FALHOU',
  CANCELADO = 'CANCELADO',
}

export enum LinhaEstado {
  PENDENTE = 'PENDENTE',
  OCR_EM_CURSO = 'OCR_EM_CURSO',
  OCR_CONCLUIDO = 'OCR_CONCLUIDO',
  EXTRACAO_EM_CURSO = 'EXTRACAO_EM_CURSO',
  EXTRACAO_CONCLUIDA = 'EXTRACAO_CONCLUIDA',
  REVISAO_HUMANA = 'REVISAO_HUMANA',
  CRIADO = 'CRIADO',
  FALHOU = 'FALHOU',
  IGNORADO = 'IGNORADO',
}

// ─── Notification ─────────────────────────────────────────

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
  READ = 'READ',
}

export enum NotificationType {
  CONTRATO_VENCIMENTO_PROXIMO = 'CONTRATO_VENCIMENTO_PROXIMO',
  JANELA_DENUNCIA_PROXIMA = 'JANELA_DENUNCIA_PROXIMA',
  RENOVACAO_AUTOMATICA_PROXIMA = 'RENOVACAO_AUTOMATICA_PROXIMA',
  PAGAMENTO_PROXIMO = 'PAGAMENTO_PROXIMO',
  ENTREGA_PROXIMA = 'ENTREGA_PROXIMA',
  IS_PENDENTE = 'IS_PENDENTE',
  IS_PRAZO_CRITICO = 'IS_PRAZO_CRITICO',
  REGISTO_PENDENTE = 'REGISTO_PENDENTE',
  BNA_PENDENTE = 'BNA_PENDENTE',
  OBRIGACAO_EM_ATRASO = 'OBRIGACAO_EM_ATRASO',
  CONTRATO_ATRIBUIDO = 'CONTRATO_ATRIBUIDO',
  IMPORTACAO_CONCLUIDA = 'IMPORTACAO_CONCLUIDA',
  IMPORTACAO_FALHOU = 'IMPORTACAO_FALHOU',
}

// ─── Audit ────────────────────────────────────────────────

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATE_TRANSITION = 'STATE_TRANSITION',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  TENANT_SWITCH = 'TENANT_SWITCH',
  IA_QUERY = 'IA_QUERY',
  COMPLIANCE_RULE_TRIGGERED = 'COMPLIANCE_RULE_TRIGGERED',
  EXPORT = 'EXPORT',
  WEBHOOK_DELIVERED = 'WEBHOOK_DELIVERED',
}

export enum EntityType {
  USER = 'USER',
  TENANT = 'TENANT',
  MEMBERSHIP = 'MEMBERSHIP',
  ENTIDADE = 'ENTIDADE',
  CARTEIRA = 'CARTEIRA',
  TIPO_CONTRATO = 'TIPO_CONTRATO',
  TEMPLATE = 'TEMPLATE',
  CLAUSULA = 'CLAUSULA',
  CONTRATO = 'CONTRATO',
  CONTRATO_VERSAO = 'CONTRATO_VERSAO',
  CONTRATO_PARTE = 'CONTRATO_PARTE',
  CONTRATO_DATA_CHAVE = 'CONTRATO_DATA_CHAVE',
  CONTRATO_OBRIGACAO = 'CONTRATO_OBRIGACAO',
  CONTRATO_ACTO_REGULATORIO = 'CONTRATO_ACTO_REGULATORIO',
  CONTRATO_NEGOCIACAO_PONTO = 'CONTRATO_NEGOCIACAO_PONTO',
  CONTRATO_TERMINACAO = 'CONTRATO_TERMINACAO',
  IMPORTACAO_LOTE = 'IMPORTACAO_LOTE',
  DOCUMENT = 'DOCUMENT',
  AI_CONVERSATION = 'AI_CONVERSATION',
  SUBSCRIPTION = 'SUBSCRIPTION',
  API_KEY = 'API_KEY',
  WEBHOOK = 'WEBHOOK',
}

// ─── Contrato Evento types (taxonomia controlada) ─────────

export enum ContratoEventoTipo {
  CRIADO = 'CRIADO',
  ESTADO_ALTERADO = 'ESTADO_ALTERADO',
  VERSAO_CRIADA = 'VERSAO_CRIADA',
  VERSAO_ENVIADA = 'VERSAO_ENVIADA',
  VERSAO_RECEBIDA = 'VERSAO_RECEBIDA',
  PARTE_ADICIONADA = 'PARTE_ADICIONADA',
  PARTE_REMOVIDA = 'PARTE_REMOVIDA',
  DATA_CHAVE_ADICIONADA = 'DATA_CHAVE_ADICIONADA',
  DATA_CHAVE_CUMPRIDA = 'DATA_CHAVE_CUMPRIDA',
  OBRIGACAO_ADICIONADA = 'OBRIGACAO_ADICIONADA',
  OBRIGACAO_CUMPRIDA = 'OBRIGACAO_CUMPRIDA',
  ACTO_DETECTADO = 'ACTO_DETECTADO',
  ACTO_CONCLUIDO = 'ACTO_CONCLUIDO',
  NEGOCIACAO_PONTO_ABERTO = 'NEGOCIACAO_PONTO_ABERTO',
  NEGOCIACAO_PONTO_RESOLVIDO = 'NEGOCIACAO_PONTO_RESOLVIDO',
  DOCUMENTO_ANEXADO = 'DOCUMENTO_ANEXADO',
  ALERTA_DISPARADO = 'ALERTA_DISPARADO',
  TERMINADO = 'TERMINADO',
  ARQUIVADO = 'ARQUIVADO',
  ADENDA_CRIADA = 'ADENDA_CRIADA',
  COMENTARIO = 'COMENTARIO',
}

// ─── Plan Limits (SaaS pricing) ───────────────────────────

export interface PlanLimits {
  contratos: number;     // -1 = unlimited
  utilizadores: number;
  storageGB: number;
  iaMessages: number;    // per month
  apiAccess: boolean;
  webhooksMax: number;
  subTenantsMax: number; // for AGENCY plan
}

export const PLAN_LIMITS: Record<TenantPlan, PlanLimits> = {
  [TenantPlan.STARTER]: {
    contratos: 200,
    utilizadores: 3,
    storageGB: 5,
    iaMessages: 100,
    apiAccess: false,
    webhooksMax: 0,
    subTenantsMax: 0,
  },
  [TenantPlan.GROWTH]: {
    contratos: 2_000,
    utilizadores: 10,
    storageGB: 50,
    iaMessages: 1_000,
    apiAccess: false,
    webhooksMax: 3,
    subTenantsMax: 0,
  },
  [TenantPlan.SCALE]: {
    contratos: 20_000,
    utilizadores: 30,
    storageGB: 500,
    iaMessages: 10_000,
    apiAccess: true,
    webhooksMax: 20,
    subTenantsMax: 0,
  },
  [TenantPlan.ENTERPRISE]: {
    contratos: -1,
    utilizadores: -1,
    storageGB: -1,
    iaMessages: -1,
    apiAccess: true,
    webhooksMax: -1,
    subTenantsMax: -1,
  },
  [TenantPlan.AGENCY]: {
    contratos: -1,
    utilizadores: 50,
    storageGB: 200,
    iaMessages: 5_000,
    apiAccess: true,
    webhooksMax: 10,
    subTenantsMax: 50,
  },
};

// ─── Result Type ──────────────────────────────────────────

export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E; code?: string };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = string>(error: E, code?: string): Result<never, E> {
  return { success: false, error, code };
}

// ─── API Types ────────────────────────────────────────────

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

// ─── JWT ──────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  // tenantId é fornecido por request header (X-Tenant-Id), não no JWT,
  // porque um user pode ter Memberships em múltiplos tenants.
  iat?: number;
  exp?: number;
}

export interface TenantContext {
  tenantId: string;
  role: Role;
  parentTenantId: string | null;
  plan: TenantPlan;
}

// ─── Audit ────────────────────────────────────────────────

export interface AuditLogEntry {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  actorUserId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
}

// ─── Compliance Engine — public types ─────────────────────

export interface ComplianceContext {
  contratoId: string;
  tenantId: string;
  tipoCodigo: string;
  categoria: TipoContratoCategoria;
  valor: bigint | null;
  moeda: string | null;
  valorEmAKZ: bigint | null;
  partesResidentes: boolean[];   // true = residente cambial
  paisesResidencia: string[];
  leiAplicavel: string | null;
  hasObjectoImovel: boolean;
  hasObjectoAutomovel: boolean;
  hasObjectoIP: boolean;
  hasObjectoSocietario: boolean;
}

export interface ComplianceActoDetectado {
  tipo: ActoRegulatorioTipo;
  regraId: string;
  regraVersao: string;
  referenciaLegal: string;
  disclaimer: string;
  tgisVerbaNumero?: string;
  baseTributavel?: bigint;
  valorLiquidar?: bigint;
  prazoLimite?: Date;
  observacoes?: string;
}

// ─── Helpers ──────────────────────────────────────────────

export const MOEDAS_SUPORTADAS = ['AKZ', 'USD', 'EUR', 'BRL', 'CNY', 'GBP', 'ZAR'] as const;
export type MoedaSuportada = typeof MOEDAS_SUPORTADAS[number];

// ─── Feriados públicos angolanos (fixos) ──────────────────
//
// Lei 11/18, de 13 de Agosto (Regime Jurídico dos Feriados Nacionais),
// com actualizações posteriores. Feriados móveis (Carnaval, Sexta-Feira
// Santa) ficam de fora desta lista — o cálculo dinâmico é feito quando
// o módulo `holidays` os incluir.

export interface PublicHoliday {
  /** ISO month-day "MM-DD" — combinado com o ano alvo. */
  monthDay: string;
  /** Nome oficial. */
  name: string;
}

export const ANGOLA_PUBLIC_HOLIDAYS_FIXOS: ReadonlyArray<PublicHoliday> = [
  { monthDay: '01-01', name: 'Ano Novo' },
  { monthDay: '02-04', name: 'Dia do Início da Luta Armada' },
  { monthDay: '03-08', name: 'Dia Internacional da Mulher' },
  { monthDay: '04-04', name: 'Dia da Paz e Reconciliação Nacional' },
  { monthDay: '05-01', name: 'Dia Internacional do Trabalhador' },
  { monthDay: '09-17', name: 'Dia do Fundador da Nação e do Herói Nacional' },
  { monthDay: '11-02', name: 'Dia dos Finados' },
  { monthDay: '11-11', name: 'Dia da Independência Nacional' },
  { monthDay: '12-25', name: 'Dia de Natal' },
] as const;

export interface ResolvedHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

export function resolveAngolaHolidays(year: number): ResolvedHoliday[] {
  return ANGOLA_PUBLIC_HOLIDAYS_FIXOS.map((h) => ({
    date: `${year}-${h.monthDay}`,
    name: h.name,
  }));
}

export const SECTORES_ACTIVIDADE = [
  'IMOBILIARIO',
  'INDUSTRIA',
  'SERVICOS',
  'COMERCIO',
  'BANCA',
  'SEGUROS',
  'PETROLEO_GAS',
  'MINERACAO',
  'TELECOMUNICACOES',
  'AGRICULTURA',
  'CONSTRUCAO',
  'TRANSPORTES',
  'SAUDE',
  'EDUCACAO',
  'TECNOLOGIA',
  'ENERGIA',
  'TURISMO',
  'RETAIL',
  'OUTRO',
] as const;
export type SectorActividade = typeof SECTORES_ACTIVIDADE[number];
