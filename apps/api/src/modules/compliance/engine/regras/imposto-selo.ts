import {
  ActoRegulatorioTipo,
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { DISCLAIMER_IS, RegraCompliance } from '../types';

/**
 * Regras de Imposto de Selo angolano — Código do Imposto de Selo (CIS)
 * + Tabela Geral do Imposto de Selo (TGIS), aprovados pelo Decreto
 * Legislativo Presidencial n.º 3/14, de 21 de Outubro.
 *
 * Verbas e taxas baseadas no diploma vigente. Valores devem ser
 * revistos quando o OGE ou decreto subsequente alterem a TGIS.
 *
 * NOTA: o regime tem isenções (art. 6.º) que ESTAS regras NÃO modelam
 * exaustivamente. O Compliance Engine sugere — confirme sempre que a
 * isenção pode aplicar-se ao caso concreto.
 *
 * Referências:
 *   - Decreto Legislativo Presidencial n.º 3/14, de 21 de Outubro
 *   - Decreto Legislativo Presidencial n.º 6/11, de 30 de Dezembro
 *   - Art. 6.º do CIS: isenções
 *   - Art. 8.º do CIS: valor tributável
 *   - Art. 12.º do CIS: taxas (Tabela anexa vigente à data)
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
  const numerador = base * BigInt(Math.round(taxaPercentagem * 10000));
  return numerador / 1_000_000n;
}

// ═══════════════════════════════════════════════════════════
// Verba 23.3 — Recibo de quitação (operações isentas de IVA)
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_PRESTACAO_SERVICOS: RegraCompliance = {
  id: 'IS_PRESTACAO_SERVICOS',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 23.3 da TGIS (Decreto Legislativo Presidencial n.º 3/14, 21-Out). ' +
    'Recibo de quitação aplicável a operações isentas de IVA: 7% sobre o ' +
    'valor recebido. Confirmar se o prestador está no regime simplificado.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.SERVICOS && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: '23.3',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 7) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'IS sobre recibo de quitação — incide aquando do recebimento. ' +
      'Sujeitos passivos: prestadores de serviços. Verifique enquadramento ' +
      'em sede de IVA — se a operação for tributada em IVA, esta verba ' +
      'pode não aplicar.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Verbas 2.1 e 2.2 — Arrendamento
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_ARRENDAMENTO_HABITACIONAL: RegraCompliance = {
  id: 'IS_ARRENDAMENTO_HABITACIONAL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 2.1 da TGIS (DLP 3/14). Arrendamento e subarrendamento para fins ' +
    'habitacionais — 0,1% sobre o valor da renda devida.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) =>
    ctx.categoria === TipoContratoCategoria.IMOBILIARIO &&
    ctx.tipoCodigo === 'ARRENDAMENTO_HABITACIONAL',
  build: (ctx) => ({
    tgisVerbaNumero: '2.1',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.1) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Liquidação mensal sobre cada renda devida. Sujeito passivo: senhorio. ' +
      'Submeter via Portal do Contribuinte no prazo de 10 dias após celebração.',
  }),
};

export const REGRA_IS_ARRENDAMENTO_COMERCIAL: RegraCompliance = {
  id: 'IS_ARRENDAMENTO_COMERCIAL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 2.2 da TGIS (DLP 3/14). Arrendamento e subarrendamento para fins ' +
    'comerciais ou industriais — 0,4% sobre o valor da renda devida.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) =>
    ctx.categoria === TipoContratoCategoria.IMOBILIARIO &&
    ctx.tipoCodigo === 'ARRENDAMENTO',
  build: (ctx) => ({
    tgisVerbaNumero: '2.2',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.4) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Liquidação mensal sobre cada renda devida. Sujeito passivo: senhorio. ' +
      'Submeter via Portal do Contribuinte no prazo de 10 dias após celebração.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Verba 16.1.1 — Operações financeiras / Crédito
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_MUTUO: RegraCompliance = {
  id: 'IS_MUTUO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 16.1.1 da TGIS (DLP 3/14). Concessão de crédito por prazo até ' +
    '1 ano — 0,5% sobre o capital mutuado. Para prazos superiores ' +
    'aplicam-se taxas diferentes (16.1.2-16.1.4).',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) => ctx.tipoCodigo === 'MUTUO' && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: '16.1.1',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.5) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Taxa 0,5% assume prazo até 1 ano. Verificar prazo real do mútuo: ' +
      '0,4% (1-5 anos), 0,3% (5+ anos), 0,1% (crédito habitação — Verba 16.1.5).',
  }),
};

// ═══════════════════════════════════════════════════════════
// Verba 1 — Aquisição onerosa/gratuita de direitos sobre imóveis
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_COMPRAVENDA_IMOVEL: RegraCompliance = {
  id: 'IS_COMPRAVENDA_IMOVEL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 1 da TGIS (DLP 3/14). Aquisição onerosa ou gratuita do direito ' +
    'de propriedade ou figuras parcelares sobre imóveis — 0,3% sobre o ' +
    'valor da transmissão. Cumulativo com SISA (Sisa sobre Transmissões ' +
    'Imobiliárias) — verifique o regime aplicável.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) =>
    ctx.categoria === TipoContratoCategoria.IMOBILIARIO &&
    (ctx.tipoCodigo === 'COMPRAVENDA_IMOVEL' || ctx.tipoCodigo === 'CPCV_IMOVEL') &&
    ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: '1',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.3) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Liquidação devida pelo adquirente. Verificar cumulação com SISA, ' +
      'que tem taxa autónoma (até 2% do valor patrimonial tributário). ' +
      'Necessário antes da escritura pública.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Verba 10 — Garantias (taxa varia com duração)
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_GARANTIA: RegraCompliance = {
  id: 'IS_GARANTIA',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 10 da TGIS (DLP 3/14). Garantias autónomas, fianças e cauções: ' +
    '10.1 (até 1 ano) 0,3%; 10.2 (1-5 anos) 0,2%; 10.3 (5+ anos ou ' +
    'indefinido) 0,1%. Aplica-se ao valor garantido.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) =>
    ['GARANTIA', 'PENHOR'].includes(ctx.tipoCodigo) && ctx.valor !== null,
  build: (ctx) => ({
    // Pessimista: taxa de prazo curto, que é a mais alta
    tgisVerbaNumero: '10.1',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 0.3) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Assume garantia com duração até 1 ano (Verba 10.1, taxa 0,3%). ' +
      'Para garantias 1-5 anos: 0,2% (10.2). 5+ anos / indefinido: 0,1% (10.3). ' +
      'Ajustar conforme prazo real do contrato.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Contratos de Trabalho — ISENÇÃO (art. 6.º, n.º 3, alínea t)
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_TRABALHO_ISENTO: RegraCompliance = {
  id: 'IS_TRABALHO_ISENTO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Art. 6.º, n.º 3, alínea t) do CIS (DLP 3/14). Os contratos de trabalho ' +
    'estão ISENTOS de Imposto de Selo. Lei n.º 7/15 (LGT) regula o regime ' +
    'laboral; IRT incide sobre os rendimentos (não sobre o contrato).',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) => ctx.categoria === TipoContratoCategoria.TRABALHO,
  build: () => ({
    tgisVerbaNumero: 'ISENTO',
    observacoes:
      'Contrato de trabalho ISENTO de IS. Acto criado para registo do ' +
      'enquadramento (DISPENSAR após confirmação). IRT incide sobre o ' +
      'salário, não sobre o contrato.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Empreitada — verba 23.3 (similar a serviços) ou Verba específica
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_EMPREITADA: RegraCompliance = {
  id: 'IS_EMPREITADA',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 23.3 da TGIS (DLP 3/14) — recibo de quitação 7% para operações ' +
    'isentas de IVA. Empreitada pode também cair sob Verba 1 se envolver ' +
    'transmissão de propriedade do imóvel construído.',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) => ctx.tipoCodigo === 'EMPREITADA' && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: '23.3',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 7) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Aplicada como prestação de serviços (Verba 23.3, 7%). Se a ' +
      'empreitada envolver transmissão de propriedade do imóvel, verificar ' +
      'Verba 1 cumulativamente.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Licença IP — Verba 23.3 (cessão de bens incorpóreos)
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_LICENCA_IP: RegraCompliance = {
  id: 'IS_LICENCA_IP',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 23.3 da TGIS (DLP 3/14) aplicada por analogia a licenças e ' +
    'cessões de direitos de propriedade intelectual / industrial. ' +
    'Royalties a não-residentes: verificar também retenção IRT (AGT).',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) =>
    ctx.categoria === TipoContratoCategoria.IP && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: '23.3',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 7) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Licenças e cessões de IP — assumido enquadramento como prestação ' +
      'de serviços (7%). Pagamentos a licenciante não-residente disparam ' +
      'também retenção IRT 15%.',
  }),
};

// ═══════════════════════════════════════════════════════════
// Fornecimento / Distribuição — Verba 23.3
// ═══════════════════════════════════════════════════════════
export const REGRA_IS_FORNECIMENTO: RegraCompliance = {
  id: 'IS_FORNECIMENTO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.IMPOSTO_SELO,
  referenciaLegal:
    'Verba 23.3 da TGIS (DLP 3/14). Verificar enquadramento em IVA — se ' +
    'tributado em IVA, esta verba pode não aplicar. Consultar Tabela ' +
    'anexa ao CIS para verbas mais específicas (15 — compras e vendas).',
  disclaimer: DISCLAIMER_IS,
  vigenteDesde: new Date('2014-10-21'),
  aplicaSe: (ctx) =>
    ['FORNECIMENTO', 'DISTRIBUICAO'].includes(ctx.tipoCodigo) && ctx.valor !== null,
  build: (ctx) => ({
    tgisVerbaNumero: '23.3',
    baseTributavel: ctx.valor ?? undefined,
    valorLiquidar: ctx.valor ? calcular(ctx.valor, 7) : undefined,
    prazoLimite: addDias(null, PRAZO_LIQUIDACAO_DIAS),
    observacoes:
      'Assumindo prestação isenta de IVA. Se houver IVA, esta verba não ' +
      'aplica. Confirmar enquadramento concreto antes de liquidar.',
  }),
};

export const REGRAS_IS: RegraCompliance[] = [
  REGRA_IS_PRESTACAO_SERVICOS,
  REGRA_IS_ARRENDAMENTO_HABITACIONAL,
  REGRA_IS_ARRENDAMENTO_COMERCIAL,
  REGRA_IS_MUTUO,
  REGRA_IS_COMPRAVENDA_IMOVEL,
  REGRA_IS_GARANTIA,
  REGRA_IS_TRABALHO_ISENTO,
  REGRA_IS_EMPREITADA,
  REGRA_IS_LICENCA_IP,
  REGRA_IS_FORNECIMENTO,
];
