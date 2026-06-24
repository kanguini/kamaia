/**
 * TGIS — Tabela Geral do Imposto de Selo (Decreto Legislativo
 * Presidencial n.º 3/14, de 21 de Outubro). Verbas e taxas conforme
 * o diploma vigente.
 *
 * Fontes:
 *   - Decreto Legislativo Presidencial n.º 3/14, de 21 de Outubro
 *   - Código do Imposto de Selo (CIS) — Art. 6.º (isenções), Art. 8.º
 *     (valor tributável), Art. 12.º (taxas).
 *
 * Notas:
 *   - Os valores aqui semeados refletem a TGIS vigente. Devem ser
 *     revistos quando o OGE ou decreto posterior alterem a Tabela.
 *   - As taxas variam por subverba (e.g. arrendamento 2.1 habitacional
 *     vs 2.2 comercial). Aqui inserimos a entrada principal de cada
 *     família — as regras do Compliance Engine sabem escolher a
 *     subverba correcta com base no tipo concreto do contrato.
 */
export interface TGISVerbaSeed {
  numero: string;
  descricao: string;
  tipoTaxa: 'PERCENTAGEM' | 'VALOR_FIXO';
  taxaValor: string;
  taxaUnidade?: string;
  baseRegra?: Record<string, unknown>;
  responsavelLiquidacao?: string;
  referenciaLegal: string;
  vigenteDesde: string;
  vigenteAte?: string;
}

const VIGENTE_DESDE = '2014-10-21';
const FONTE = 'Decreto Legislativo Presidencial n.º 3/14, de 21 de Outubro';

export const TGIS_SEED: TGISVerbaSeed[] = [
  {
    numero: '1',
    descricao:
      'Aquisição onerosa ou gratuita do direito de propriedade ou figuras parcelares sobre imóveis.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.3',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Adquirente',
    referenciaLegal: `Verba 1, ${FONTE}. Cumulativo com SISA.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '2.1',
    descricao: 'Arrendamento e subarrendamento — fins habitacionais.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Senhorio',
    referenciaLegal: `Verba 2.1, ${FONTE}. Liquidação mensal sobre cada renda.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '2.2',
    descricao: 'Arrendamento e subarrendamento — fins comerciais ou industriais.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.4',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Senhorio',
    referenciaLegal: `Verba 2.2, ${FONTE}. Liquidação mensal sobre cada renda.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '10.1',
    descricao: 'Garantias autónomas, cauções e fianças — prazo até 1 ano.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.3',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Beneficiário',
    referenciaLegal: `Verba 10.1, ${FONTE}.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '10.2',
    descricao: 'Garantias autónomas, cauções e fianças — prazo de 1 a 5 anos.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.2',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Beneficiário',
    referenciaLegal: `Verba 10.2, ${FONTE}.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '10.3',
    descricao: 'Garantias autónomas, cauções e fianças — 5+ anos ou indefinido.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Beneficiário',
    referenciaLegal: `Verba 10.3, ${FONTE}.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '12',
    descricao: 'Licenças (estabelecimentos, espectáculos, restauração, hotelaria).',
    tipoTaxa: 'VALOR_FIXO',
    taxaValor: '1500',
    taxaUnidade: 'AOA',
    responsavelLiquidacao: 'Titular',
    referenciaLegal: `Verba 12, ${FONTE}. Valores variam por tipo de licença (AOA 1.500 — 100.000).`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '16.1.1',
    descricao: 'Concessão de crédito — prazo até 1 ano.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.5',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Mutuante',
    referenciaLegal: `Verba 16.1.1, ${FONTE}. Mútuos.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '16.1.2',
    descricao: 'Concessão de crédito — prazo de 1 a 5 anos.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.4',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Mutuante',
    referenciaLegal: `Verba 16.1.2, ${FONTE}.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '16.1.5',
    descricao: 'Concessão de crédito à habitação.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Mutuante',
    referenciaLegal: `Verba 16.1.5, ${FONTE}.`,
    vigenteDesde: VIGENTE_DESDE,
  },
  {
    numero: '23.3',
    descricao:
      'Recibo de quitação para operações isentas de IVA — incidência sobre o valor recebido.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '7',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Prestador',
    referenciaLegal: `Verba 23.3, ${FONTE}. Aplica-se a operações isentas de IVA. ` +
      'Verifique enquadramento concreto — operação tributada em IVA está fora desta verba.',
    vigenteDesde: VIGENTE_DESDE,
  },
];
