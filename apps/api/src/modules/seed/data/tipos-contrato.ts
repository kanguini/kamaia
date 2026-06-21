import { TipoContratoCategoria } from '@kamaia/shared-types';

/**
 * Catálogo global (tenantId=null) de tipos de contrato.
 * Cobertura intencionalmente larga e horizontal — qualquer sector
 * angolano deve encontrar aqui o tipo aplicável.
 *
 * Os gatilhos regulatórios (tgisVerba, requerNotario, registos) são
 * defaults — o utilizador pode override por contrato.
 */
export interface TipoContratoSeed {
  codigo: string;
  nome: string;
  categoria: TipoContratoCategoria;
  descricao?: string;
  tgisVerbaNumero?: string;
  requerNotario?: boolean;
  registosRequeridos?: string[];
  gatilhoBNA?: Record<string, unknown>;
  retencaoIRTpadrao?: boolean;
  clausulasObrigatorias?: string[];
}

export const TIPOS_CONTRATO_SEED: TipoContratoSeed[] = [
  // ─── PRÉ-CONTRATO ─────────────────────────────────────────
  {
    codigo: 'NDA',
    nome: 'Acordo de Confidencialidade (NDA)',
    categoria: TipoContratoCategoria.PRE_CONTRATO,
    tgisVerbaNumero: 'TBD-NDA',
    clausulasObrigatorias: ['CONFIDENCIALIDADE', 'PRAZO', 'LEI_APLICAVEL', 'FORO'],
  },
  {
    codigo: 'MOU',
    nome: 'Memorando de Entendimento (MOU)',
    categoria: TipoContratoCategoria.PRE_CONTRATO,
    tgisVerbaNumero: 'TBD-MOU',
    clausulasObrigatorias: ['OBJECTO', 'PRAZO', 'EFEITOS', 'LEI_APLICAVEL'],
  },
  {
    codigo: 'LOI',
    nome: 'Letter of Intent (LOI)',
    categoria: TipoContratoCategoria.PRE_CONTRATO,
    tgisVerbaNumero: 'TBD-MOU',
  },
  // ─── SERVIÇOS ─────────────────────────────────────────────
  {
    codigo: 'PRESTACAO_SERVICOS',
    nome: 'Contrato de Prestação de Serviços',
    categoria: TipoContratoCategoria.SERVICOS,
    tgisVerbaNumero: 'TBD-SERVICOS',
    clausulasObrigatorias: [
      'OBJECTO', 'PRECO', 'PRAZO', 'OBRIGACOES_PRESTADOR',
      'OBRIGACOES_ADQUIRENTE', 'CONFIDENCIALIDADE', 'FORO', 'LEI_APLICAVEL',
    ],
  },
  {
    codigo: 'SLA',
    nome: 'Acordo de Nível de Serviço (SLA)',
    categoria: TipoContratoCategoria.SERVICOS,
    tgisVerbaNumero: 'TBD-SERVICOS',
    clausulasObrigatorias: ['NIVEIS_SERVICO', 'CREDITOS', 'MEDICAO', 'REPORTING'],
  },
  {
    codigo: 'AVENCA',
    nome: 'Avença / Retainer',
    categoria: TipoContratoCategoria.SERVICOS,
    tgisVerbaNumero: 'TBD-SERVICOS',
  },
  {
    codigo: 'MANDATO',
    nome: 'Contrato de Mandato',
    categoria: TipoContratoCategoria.SERVICOS,
    tgisVerbaNumero: 'TBD-SERVICOS',
  },
  {
    codigo: 'CONSULTORIA',
    nome: 'Contrato de Consultoria',
    categoria: TipoContratoCategoria.SERVICOS,
    tgisVerbaNumero: 'TBD-SERVICOS',
  },
  // ─── BENS ─────────────────────────────────────────────────
  {
    codigo: 'COMPRAVENDA_MOVEIS',
    nome: 'Compra e Venda de Bens Móveis',
    categoria: TipoContratoCategoria.BENS,
    tgisVerbaNumero: 'TBD-CV-MOVEIS',
    clausulasObrigatorias: ['OBJECTO', 'PRECO', 'ENTREGA', 'GARANTIAS', 'TRANSFERENCIA_RISCO'],
  },
  {
    codigo: 'FORNECIMENTO',
    nome: 'Contrato de Fornecimento de Bens',
    categoria: TipoContratoCategoria.BENS,
    tgisVerbaNumero: 'TBD-CV-MOVEIS',
  },
  {
    codigo: 'DISTRIBUICAO',
    nome: 'Contrato de Distribuição',
    categoria: TipoContratoCategoria.BENS,
    tgisVerbaNumero: 'TBD-CV-MOVEIS',
  },
  {
    codigo: 'AGENCIA',
    nome: 'Contrato de Agência',
    categoria: TipoContratoCategoria.BENS,
    tgisVerbaNumero: 'TBD-SERVICOS',
  },
  {
    codigo: 'COMPRAVENDA_AUTOMOVEL',
    nome: 'Compra e Venda de Veículo Automóvel',
    categoria: TipoContratoCategoria.BENS,
    tgisVerbaNumero: 'TBD-CV-MOVEIS',
    registosRequeridos: ['REGISTO_AUTOMOVEL'],
  },
  // ─── IMOBILIÁRIO ──────────────────────────────────────────
  {
    codigo: 'ARRENDAMENTO',
    nome: 'Contrato de Arrendamento',
    categoria: TipoContratoCategoria.IMOBILIARIO,
    tgisVerbaNumero: 'TBD-ARRENDAMENTO',
    clausulasObrigatorias: ['OBJECTO', 'RENDA', 'PRAZO', 'OBRAS', 'DENUNCIA', 'FORO'],
  },
  {
    codigo: 'ARRENDAMENTO_HABITACIONAL',
    nome: 'Contrato de Arrendamento Habitacional',
    categoria: TipoContratoCategoria.IMOBILIARIO,
    tgisVerbaNumero: 'TBD-ARRENDAMENTO',
  },
  {
    codigo: 'CPCV_IMOVEL',
    nome: 'Contrato Promessa de Compra e Venda de Imóvel',
    categoria: TipoContratoCategoria.IMOBILIARIO,
    tgisVerbaNumero: 'TBD-CV-IMOVEL',
  },
  {
    codigo: 'COMPRAVENDA_IMOVEL',
    nome: 'Compra e Venda de Imóvel',
    categoria: TipoContratoCategoria.IMOBILIARIO,
    tgisVerbaNumero: 'TBD-CV-IMOVEL',
    requerNotario: true,
    registosRequeridos: ['REGISTO_PREDIAL'],
    clausulasObrigatorias: ['OBJECTO', 'PRECO', 'TRADICAO', 'GARANTIAS', 'IS', 'SISA'],
  },
  {
    codigo: 'EMPREITADA',
    nome: 'Contrato de Empreitada',
    categoria: TipoContratoCategoria.IMOBILIARIO,
    tgisVerbaNumero: 'TBD-EMPREITADA',
  },
  // ─── FINANCEIRO ───────────────────────────────────────────
  {
    codigo: 'MUTUO',
    nome: 'Contrato de Mútuo',
    categoria: TipoContratoCategoria.FINANCEIRO,
    tgisVerbaNumero: 'TBD-MUTUO',
    gatilhoBNA: { partesNaoResidentes: true },
    clausulasObrigatorias: ['CAPITAL', 'PRAZO', 'JUROS', 'REEMBOLSO', 'GARANTIAS'],
  },
  {
    codigo: 'GARANTIA',
    nome: 'Contrato de Garantia / Caução',
    categoria: TipoContratoCategoria.FINANCEIRO,
    tgisVerbaNumero: 'TBD-GARANTIA',
  },
  {
    codigo: 'PENHOR',
    nome: 'Contrato de Penhor',
    categoria: TipoContratoCategoria.FINANCEIRO,
    tgisVerbaNumero: 'TBD-GARANTIA',
  },
  // ─── TRABALHO ─────────────────────────────────────────────
  {
    codigo: 'TRABALHO',
    nome: 'Contrato de Trabalho',
    categoria: TipoContratoCategoria.TRABALHO,
    tgisVerbaNumero: 'TBD-TRABALHO',
    clausulasObrigatorias: ['FUNCOES', 'REMUNERACAO', 'HORARIO', 'PRAZO', 'CESSACAO'],
  },
  {
    codigo: 'TRABALHO_EXECUTIVO',
    nome: 'Contrato de Trabalho — Executivo / Quadro Superior',
    categoria: TipoContratoCategoria.TRABALHO,
    tgisVerbaNumero: 'TBD-TRABALHO',
  },
  // ─── IP ───────────────────────────────────────────────────
  {
    codigo: 'LICENCA_SOFTWARE',
    nome: 'Contrato de Licença de Software',
    categoria: TipoContratoCategoria.IP,
    tgisVerbaNumero: 'TBD-LICENCA-IP',
  },
  {
    codigo: 'CESSAO_IP',
    nome: 'Contrato de Cessão de Direitos de Propriedade Industrial',
    categoria: TipoContratoCategoria.IP,
    tgisVerbaNumero: 'TBD-LICENCA-IP',
    registosRequeridos: ['REGISTO_IP_IAPI'],
  },
  {
    codigo: 'LICENCA_MARCA',
    nome: 'Contrato de Licença de Marca',
    categoria: TipoContratoCategoria.IP,
    tgisVerbaNumero: 'TBD-LICENCA-IP',
    registosRequeridos: ['REGISTO_IP_IAPI'],
  },
];
