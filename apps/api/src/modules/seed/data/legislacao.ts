/**
 * Diplomas-âncora para o RAG da IA. Lista curada com os textos
 * legislativos angolanos essenciais para Q&A jurídica.
 *
 * O conteúdo dos diplomas é injectado por pipeline separado (não
 * versionamos textos legais no git). Aqui apenas o catálogo de
 * metadados; o operador faz a ingestão via endpoint admin.
 */
export interface LegislacaoSeed {
  codigo: string;
  titulo: string;
  diploma: string;
  publicacao?: string;       // ISO
  emVigorDesde?: string;
  url?: string;
}

export const LEGISLACAO_SEED: LegislacaoSeed[] = [
  {
    codigo: 'CRA',
    titulo: 'Constituição da República de Angola',
    diploma: 'Constituição de 2010 (com alterações)',
    emVigorDesde: '2010-02-05',
  },
  {
    codigo: 'CC',
    titulo: 'Código Civil',
    diploma: 'Código Civil aprovado pelo Decreto-Lei n.º 47 344, de 25 de Novembro de 1966, com alterações',
  },
  {
    codigo: 'CCom',
    titulo: 'Código Comercial',
    diploma: 'Código Comercial (1888), com alterações aplicáveis em Angola',
  },
  {
    codigo: 'LSC',
    titulo: 'Lei das Sociedades Comerciais',
    diploma: 'Lei n.º 1/04, de 13 de Fevereiro, com alterações',
  },
  {
    codigo: 'CIS',
    titulo: 'Código do Imposto de Selo',
    diploma: 'Diploma vigente do Código do Imposto de Selo + TGIS',
  },
  {
    codigo: 'CGT_LGT',
    titulo: 'Lei Geral Tributária + Códigos Tributários',
    diploma: 'LGT + Código do IRT + Código do IVA + Código do II (Imposto Industrial)',
  },
  {
    codigo: 'LGT',
    titulo: 'Lei Geral do Trabalho',
    diploma: 'Lei n.º 7/15, de 15 de Junho (LGT)',
  },
  {
    codigo: 'LIP',
    titulo: 'Lei do Investimento Privado',
    diploma: 'Lei do Investimento Privado vigente',
  },
  {
    codigo: 'LEI_CAMBIAL',
    titulo: 'Lei Cambial + RJOC',
    diploma: 'Lei Cambial + Regime Jurídico dos Operadores Cambiais + Avisos BNA aplicáveis',
  },
  {
    codigo: 'LEI_22_11',
    titulo: 'Lei de Protecção de Dados Pessoais',
    diploma: 'Lei n.º 22/11, de 17 de Junho',
    emVigorDesde: '2011-06-17',
  },
  {
    codigo: 'LEI_3_14',
    titulo: 'Lei do Combate ao Branqueamento de Capitais e ao Financiamento do Terrorismo',
    diploma: 'Lei n.º 3/14, de 10 de Fevereiro (com revisões posteriores)',
    emVigorDesde: '2014-02-10',
  },
  {
    codigo: 'CRC',
    titulo: 'Código do Registo Comercial',
    diploma: 'Código do Registo Comercial vigente',
  },
  {
    codigo: 'CRP',
    titulo: 'Código do Registo Predial',
    diploma: 'Código do Registo Predial vigente',
  },
];
