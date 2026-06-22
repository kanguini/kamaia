import {
  ActoRegulatorioTipo,
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { DISCLAIMER_IS, RegraCompliance } from '../types';

/**
 * Regras de Imposto de Selo angolano — Código do Imposto de Selo (CIS)
 * e Tabela Geral do Imposto de Selo (TGIS).
 *
 * NOTA IMPORTANTE: os valores das verbas e taxas são valores indicativos
 * para arranque do produto. Devem ser validados por curador jurídico
 * antes de irem a produção e revistos a cada alteração da TGIS por
 * Decreto Executivo ou OGE. Cada regra carrega `referenciaLegal` que
 * deve ser actualizada quando a base legal muda.
 */

const PRAZO_LIQUIDACAO_DIAS = 30;

function addDias(base: Date | null, dias: number): Date {
  const d = base ?? new Date();
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

/** Calcula valor a liquidar dada base e taxa percentual em centavos. */
function calcular(base: bigint, taxaPercentagem: number): bigint {
  // taxa em décimas de basis points para precisão
  // ex: 0.5% → 50
  const numerador = base * BigInt(Math.round(taxaPercentagem * 10000));
  return numerador / 1_000_000n;
}

export const REGRA_IS_PRESTACAO_SERVICOS: RegraCompliance = {
  id: 'IS_PRESTACAO_SERVICOS',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável aos contratos de prestação de serviços (a confirmar versão vigente). ' +
    'CIS arts. 1.º e 2.º quanto à incidência.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.SERVICOS && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-SERVICOS',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 1) : undefined,  // taxa exemplo 1%
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Taxa indicativa 1%. Verifique a verba e taxa vigentes na TGIS ' +
      'aplicável à data de celebração.',
  }),
};

export const REGRA_IS_ARRENDAMENTO: RegraCompliance = {
  id: 'IS_ARRENDAMENTO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável aos contratos de arrendamento (a confirmar versão vigente). ' +
    'A liquidação é mensal sobre cada renda devida.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.IMOBILIARIO &&
    (ctx.tipoCodigo === 'ARRENDAMENTO' || ctx.tipoCodigo === 'ARRENDAMENTO_HABITACIONAL'),
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-ARRENDAMENTO',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.4) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Taxa indicativa 0.4%. Confirme a verba TGIS e o regime de ' +
      'periodicidade aplicável (mensal sobre cada renda).',
  }),
};

export const REGRA_IS_MUTUO: RegraCompliance = {
  id: 'IS_MUTUO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável aos contratos de mútuo. CIS art. 1.º e segs.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.tipoCodigo === 'MUTUO' && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-MUTUO',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.1) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes: 'Taxa indicativa 0.1% por mês. Confirme regime aplicável.',
  }),
};

export const REGRA_IS_COMPRAVENDA_IMOVEL: RegraCompliance = {
  id: 'IS_COMPRAVENDA_IMOVEL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável aos contratos de compra e venda de imóveis. ' +
    'Pode existir cumulativamente com SISA — verifique o regime aplicável.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.IMOBILIARIO &&
    (ctx.tipoCodigo === 'COMPRAVENDA_IMOVEL' ||
      ctx.tipoCodigo === 'CPCV_IMOVEL') &&
    ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-CV-IMOVEL',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.3) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Taxa indicativa 0.3%. Verifique SISA cumulativa e isenções aplicáveis.',
  }),
};

export const REGRA_IS_TRABALHO: RegraCompliance = {
  id: 'IS_CONTRATO_TRABALHO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável aos contratos de trabalho. ' +
    'Lei Geral do Trabalho (Lei n.º 7/15, com alterações).',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.TRABALHO,
  build: (_ctx) => ({
    tgisVerbaNumero: 'TBD-TRABALHO',
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Verifique a verba TGIS específica para contratos de trabalho ' +
      'e eventuais isenções aplicáveis.',
  }),
};

export const REGRA_IS_EMPREITADA: RegraCompliance = {
  id: 'IS_EMPREITADA',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal: 'TGIS — Verba aplicável aos contratos de empreitada.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.tipoCodigo === 'EMPREITADA' && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-EMPREITADA',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 1) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes: 'Taxa indicativa 1%. Confirme regime aplicável a empreitadas.',
  }),
};

export const REGRA_IS_GARANTIA: RegraCompliance = {
  id: 'IS_GARANTIA',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável a garantias autónomas, cauções e fianças.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ['GARANTIA', 'PENHOR'].includes(ctx.tipoCodigo) && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-GARANTIA',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.3) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes: 'Taxa indicativa 0.3%. Confirme verba TGIS específica.',
  }),
};

export const REGRA_IS_LICENCA_IP: RegraCompliance = {
  id: 'IS_LICENCA_IP',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal: 'TGIS — Verba aplicável a licenças e cessões de IP.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.IP && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-LICENCA-IP',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 1) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Taxa indicativa 1%. Para licenças com royalties periódicos, ' +
      'considere liquidação por cada pagamento.',
  }),
};

export const REGRA_IS_FORNECIMENTO: RegraCompliance = {
  id: 'IS_FORNECIMENTO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'TGIS — Verba aplicável a contratos de fornecimento de bens.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ['FORNECIMENTO', 'DISTRIBUICAO'].includes(ctx.tipoCodigo) &&
    ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: 'TBD-CV-MOVEIS',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.5) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes: 'Taxa indicativa 0.5%. Confirme verba TGIS aplicável.',
  }),
};

export const REGRAS_IS: RegraCompliance[] = [
  REGRA_IS_PRESTACAO_SERVICOS,
  REGRA_IS_ARRENDAMENTO,
  REGRA_IS_MUTUO,
  REGRA_IS_COMPRAVENDA_IMOVEL,
  REGRA_IS_TRABALHO,
  REGRA_IS_EMPREITADA,
  REGRA_IS_GARANTIA,
  REGRA_IS_LICENCA_IP,
  REGRA_IS_FORNECIMENTO,
];
