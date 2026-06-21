/**
 * TGIS — Tabela Geral do Imposto de Selo (seed inicial).
 *
 * IMPORTANTE: valores e verbas são INDICATIVOS para arranque do MVP.
 * Devem ser validados por curador jurídico antes de produção.
 * Cada vez que a TGIS for revista por Decreto Executivo/OGE, novas
 * entradas devem ser adicionadas com `vigenteDesde` actualizado e a
 * entrada anterior recebe `vigenteAte`.
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
  vigenteDesde: string;  // ISO
  vigenteAte?: string;
}

export const TGIS_SEED: TGISVerbaSeed[] = [
  {
    numero: 'TBD-SERVICOS',
    descricao:
      'Contratos de prestação de serviços (verba TGIS aplicável — confirmar).',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Prestador / Adquirente conforme regime',
    referenciaLegal: 'CIS + TGIS — verba aplicável a prestação de serviços (TBC)',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-ARRENDAMENTO',
    descricao:
      'Contratos de arrendamento — liquidação mensal sobre cada renda.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.4',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Senhorio',
    referenciaLegal: 'CIS + TGIS — verba aplicável ao arrendamento (TBC)',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-MUTUO',
    descricao:
      'Contratos de mútuo — incidência por mês ou fracção do prazo.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Mutuante',
    referenciaLegal: 'CIS + TGIS — verba aplicável a mútuos (TBC)',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-CV-IMOVEL',
    descricao:
      'Contratos de compra e venda de imóveis. Verificar SISA cumulativa.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.3',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Adquirente',
    referenciaLegal:
      'CIS + TGIS — verba aplicável à compra e venda de imóveis (TBC). ' +
      'Pode existir SISA cumulativa.',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-CV-MOVEIS',
    descricao: 'Contratos de compra e venda de bens móveis.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.5',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Adquirente',
    referenciaLegal: 'CIS + TGIS — verba a confirmar (TBC).',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-TRABALHO',
    descricao: 'Contratos de trabalho (regime e isenções a confirmar).',
    tipoTaxa: 'VALOR_FIXO',
    taxaValor: '0',
    taxaUnidade: 'AKZ',
    responsavelLiquidacao: 'Empregador',
    referenciaLegal: 'CIS + TGIS — confirmar regime e isenções (TBC).',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-GARANTIA',
    descricao: 'Garantias autónomas, cauções, fianças.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '0.3',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Beneficiário',
    referenciaLegal: 'CIS + TGIS — verba aplicável a garantias (TBC).',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-EMPREITADA',
    descricao: 'Contratos de empreitada de obras.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Dono da obra',
    referenciaLegal: 'CIS + TGIS — verba aplicável a empreitada (TBC).',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-LICENCA-IP',
    descricao: 'Licenças e cessões de direitos de propriedade industrial.',
    tipoTaxa: 'PERCENTAGEM',
    taxaValor: '1',
    taxaUnidade: '%',
    responsavelLiquidacao: 'Licenciado',
    referenciaLegal: 'CIS + TGIS — verba a confirmar (TBC).',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-NDA',
    descricao: 'NDA / Acordo de confidencialidade. Normalmente sem valor.',
    tipoTaxa: 'VALOR_FIXO',
    taxaValor: '0',
    taxaUnidade: 'AKZ',
    referenciaLegal: 'Não incidência genérica; confirmar caso a caso.',
    vigenteDesde: '2026-01-01',
  },
  {
    numero: 'TBD-MOU',
    descricao: 'Memorando de entendimento / LOI sem efeitos vinculativos.',
    tipoTaxa: 'VALOR_FIXO',
    taxaValor: '0',
    taxaUnidade: 'AKZ',
    referenciaLegal: 'Não incidência genérica; confirmar caso a caso.',
    vigenteDesde: '2026-01-01',
  },
];
