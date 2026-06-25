import { TenantPlan, PLAN_LIMITS, PLAN_AI_CREDITS } from '@kamaia/shared-types';

/**
 * Catálogo canónico dos planos do Kamaia.
 *
 * Único ponto de verdade — usado por:
 *  - BillingService.getStatus para reportar limites
 *  - Migrations/seeds para criar UsageQuota inicial
 *  - Marketing site (próximo sprint) para tabela de pricing
 *
 * Preços em **AKZ/mês**. Conversão para AOA cosmético, mas
 * armazenamos em centavos (BigInt) quando vamos a faturação real.
 *
 * Decisão Sprint 4.1: alinha o pricing com Contracko (per-contratos
 * + AI credits) mas adapta valores ao mercado angolano.
 */

export interface PlanQuotas {
  contratosLimit: number;
  utilizadoresLimit: number;
  storageGBLimit: number;
  /** Mensagens de chat com Kamaia AI. Grátis dentro do plano. */
  iaMessagesLimit: number;
  /** Credits para operações de alto custo (parsing, drafting). */
  aiCreditsLimit: number;
}

export interface PlanConfig {
  /** Identificador do plano (key do enum). */
  plan: TenantPlan;
  /** Label em pt-AO para UI / marketing. */
  label: string;
  /** Slug para URLs. */
  slug: string;
  /** Preço mensal em centavos AKZ. */
  precoMensalCentavos: number;
  /** Frase curta de posicionamento. */
  tagline: string;
  /** Highlights para os cards do marketing site. */
  highlights: string[];
  /** Limites de uso. */
  quotas: PlanQuotas;
  /** Visível ao público (esconde planos beta / sob proposta). */
  isPublic: boolean;
}

/**
 * Helper: deriva `PlanQuotas` (formato da DB) a partir dos limites
 * canónicos em shared-types. Mantém um único source of truth para
 * os números — ANY mudança nos limites obriga a alterar UM
 * ficheiro só (`packages/shared-types/src/index.ts`).
 *
 * `-1` é preservado: quota guards no backend tratam `< 0` como
 * unlimited; UI traduz para "Sem limite".
 */
function quotasFromLimits(plan: TenantPlan): PlanQuotas {
  const l = PLAN_LIMITS[plan];
  return {
    contratosLimit: l.contratos,
    utilizadoresLimit: l.utilizadores,
    storageGBLimit: l.storageGB,
    iaMessagesLimit: l.iaMessages,
    aiCreditsLimit: PLAN_AI_CREDITS[plan],
  };
}

export const PLANS: Record<TenantPlan, PlanConfig> = {
  [TenantPlan.STARTER]: {
    plan: TenantPlan.STARTER,
    label: 'Inicial',
    slug: 'inicial',
    precoMensalCentavos: 75_00_00, // AKZ 75 000
    tagline: 'Para começar a centralizar a tua carteira.',
    highlights: [
      'Até 50 contratos activos',
      '3 utilizadores',
      '100 mensagens de Kamaia AI / mês',
      '100 créditos IA para parsing',
      'Compliance angolano completo',
      '1 GB de armazenamento',
    ],
    quotas: quotasFromLimits(TenantPlan.STARTER),
    isPublic: true,
  },

  [TenantPlan.GROWTH]: {
    plan: TenantPlan.GROWTH,
    label: 'Crescimento',
    slug: 'crescimento',
    precoMensalCentavos: 175_00_00, // AKZ 175 000
    tagline: 'Para PMEs com carteira em expansão.',
    highlights: [
      'Até 150 contratos activos',
      '6 utilizadores',
      '300 mensagens de Kamaia AI / mês',
      '300 créditos IA',
      'Webhooks + integrações básicas',
      '5 GB de armazenamento',
    ],
    quotas: quotasFromLimits(TenantPlan.GROWTH),
    isPublic: true,
  },

  [TenantPlan.SCALE]: {
    plan: TenantPlan.SCALE,
    label: 'Profissional',
    slug: 'profissional',
    precoMensalCentavos: 425_00_00, // AKZ 425 000
    tagline: 'Para empresas com carteira robusta.',
    highlights: [
      'Até 500 contratos activos',
      '15 utilizadores',
      '1 000 mensagens de Kamaia AI / mês',
      '1 000 créditos IA',
      'Backup automático diário',
      'Audit log com retenção 5 anos',
      '20 GB de armazenamento',
    ],
    quotas: quotasFromLimits(TenantPlan.SCALE),
    isPublic: true,
  },

  [TenantPlan.ENTERPRISE]: {
    plan: TenantPlan.ENTERPRISE,
    label: 'Empresa',
    slug: 'empresa',
    precoMensalCentavos: 950_00_00, // AKZ 950 000
    tagline: 'Para organizações com carteira complexa.',
    highlights: [
      'Até 2 000 contratos activos',
      '40 utilizadores',
      '3 000 mensagens de Kamaia AI / mês',
      '3 000 créditos IA',
      'SSO (SAML / OIDC)',
      'SLA com tempo de resposta',
      'Account manager dedicado',
      '100 GB de armazenamento',
    ],
    quotas: quotasFromLimits(TenantPlan.ENTERPRISE),
    isPublic: true,
  },

  [TenantPlan.AGENCY]: {
    plan: TenantPlan.AGENCY,
    label: 'Agência',
    slug: 'agencia',
    precoMensalCentavos: 0, // sob proposta
    tagline: 'Para sociedades de advogados que servem múltiplos clientes.',
    highlights: [
      'Sub-tenants ilimitados',
      'Cada cliente como tenant filho com a sua carteira',
      'Branding white-label',
      'Faturação consolidada',
      'AI credits agregados, partilhados entre clientes',
      'Sob proposta',
    ],
    quotas: quotasFromLimits(TenantPlan.AGENCY),
    // Onda B.SEC.15: AGENCY agora isPublic=false para não expor as
    // quotas internas via /billing/plans (que é unauth). O marketing
    // site mostra apenas "Agência: sob proposta" sem detalhar
    // limites. Quem se inscreve via /contacto recebe a proposta
    // personalizada.
    isPublic: false,
  },
};

/**
 * Helper para obter as quotas de um plano (ou STARTER se enum
 * inválido). Usado por BillingService e migrations.
 */
export function quotasForPlan(plan: TenantPlan): PlanQuotas {
  return PLANS[plan]?.quotas ?? PLANS[TenantPlan.STARTER].quotas;
}

/**
 * Lista de planos públicos para o marketing site / page de billing.
 * Devolve por ordem crescente de preço.
 */
export function publicPlans(): PlanConfig[] {
  return Object.values(PLANS)
    .filter((p) => p.isPublic)
    .sort((a, b) => a.precoMensalCentavos - b.precoMensalCentavos);
}
