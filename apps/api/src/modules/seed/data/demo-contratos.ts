/**
 * Demo contratos — carteira-tipo de uma empresa multi-sector para que
 * o dashboard tenha algo a mostrar sem importação manual. Os contratos
 * cobrem vários estados, valores e gatilhos de compliance para
 * demonstrar o engine.
 *
 * Executar via SeedService.seedDemoCarteira() — idempotente.
 */
import { ContratoEstado, PartePapel, DataChaveTipo } from '@kamaia/shared-types';

export interface DemoContratoSeed {
  numeroInterno: string;
  titulo: string;
  descricao?: string;
  tipoCodigo: string;            // resolve para TipoContrato.id
  estado: ContratoEstado;
  valor?: bigint;
  moeda?: string;
  valorEmAKZ?: bigint;
  leiAplicavel?: string;
  foro?: string;
  dataAssinatura?: string;       // ISO
  dataInicioVigencia?: string;
  dataTermo?: string;
  renovacaoAutomatica?: boolean;
  janelaDenunciaDias?: number;
  prazoIndeterminado?: boolean;
  partes: Array<{
    entidadeIndex: 'SELF' | number;  // SELF = nossa empresa; 0..N = índice na lista de entidades demo
    papel: PartePapel;
    representanteNome?: string;
  }>;
  datasChave?: Array<{
    tipo: DataChaveTipo;
    data: string;
    descricao?: string;
  }>;
  /** Disparar o ComplianceEngine após criação */
  avaliarCompliance?: boolean;
}

export interface DemoEntidadeSeed {
  nome: string;
  tipo: 'PESSOA_SINGULAR' | 'PESSOA_COLECTIVA';
  nif?: string;
  nacionalidadeCambial: 'RESIDENTE' | 'NAO_RESIDENTE';
  paisResidencia?: string;
  sectorActividade?: string;
}

export const DEMO_ENTIDADES: DemoEntidadeSeed[] = [
  {
    nome: 'TotalEnergies Angola, Lda',
    tipo: 'PESSOA_COLECTIVA',
    nif: '5400000001',
    nacionalidadeCambial: 'NAO_RESIDENTE',
    paisResidencia: 'FR',
    sectorActividade: 'PETROLEO_GAS',
  },
  {
    nome: 'Sonangás, S.A.',
    tipo: 'PESSOA_COLECTIVA',
    nif: '5410000001',
    nacionalidadeCambial: 'RESIDENTE',
    sectorActividade: 'ENERGIA',
  },
  {
    nome: 'BFA — Banco de Fomento Angola',
    tipo: 'PESSOA_COLECTIVA',
    nif: '5410000002',
    nacionalidadeCambial: 'RESIDENTE',
    sectorActividade: 'BANCA',
  },
  {
    nome: 'João Manuel Pedro',
    tipo: 'PESSOA_SINGULAR',
    nif: '0033001LA',
    nacionalidadeCambial: 'RESIDENTE',
  },
  {
    nome: 'Microsoft Ireland Operations Ltd',
    tipo: 'PESSOA_COLECTIVA',
    nif: 'IE8256796U',
    nacionalidadeCambial: 'NAO_RESIDENTE',
    paisResidencia: 'IE',
    sectorActividade: 'TECNOLOGIA',
  },
  {
    nome: 'Castel Indústrias Lda',
    tipo: 'PESSOA_COLECTIVA',
    nif: '5410000003',
    nacionalidadeCambial: 'RESIDENTE',
    sectorActividade: 'INDUSTRIA',
  },
  {
    nome: 'Imobiliária Talatona, Lda',
    tipo: 'PESSOA_COLECTIVA',
    nif: '5410000004',
    nacionalidadeCambial: 'RESIDENTE',
    sectorActividade: 'IMOBILIARIO',
  },
];

// AKZ em centavos
const AKZ = (n: number) => BigInt(n * 100);
const USD = (n: number) => BigInt(n * 100);

export const DEMO_CONTRATOS: DemoContratoSeed[] = [
  // ─── 1. Serviços IA (estado ACTIVO, expira em 90 dias, com não-residente) ─
  {
    numeroInterno: 'CT-2026-D0001',
    titulo: 'Prestação de serviços de cloud — Microsoft Azure',
    descricao: 'Subscrição anual de serviços Azure com suporte premier',
    tipoCodigo: 'PRESTACAO_SERVICOS',
    estado: ContratoEstado.ACTIVO,
    valor: USD(180_000),
    moeda: 'USD',
    valorEmAKZ: AKZ(153_000_000),
    leiAplicavel: 'Lei angolana',
    foro: 'Tribunal Provincial de Luanda',
    dataAssinatura: '2025-09-15',
    dataInicioVigencia: '2025-10-01',
    dataTermo: '2026-09-30',  // vence em ~3 meses
    renovacaoAutomatica: true,
    janelaDenunciaDias: 90,
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 4, papel: PartePapel.CONTRAPARTE },  // Microsoft
    ],
    datasChave: [
      { tipo: DataChaveTipo.TERMO, data: '2026-09-30', descricao: 'Termo natural' },
      { tipo: DataChaveTipo.JANELA_DENUNCIA_FIM, data: '2026-07-02', descricao: 'Última data para denunciar' },
      { tipo: DataChaveTipo.RENOVACAO_AUTOMATICA, data: '2026-10-01', descricao: 'Renova automaticamente' },
    ],
    avaliarCompliance: true,
  },

  // ─── 2. Arrendamento de escritório (ACTIVO) ──────────────
  {
    numeroInterno: 'CT-2026-D0002',
    titulo: 'Arrendamento de escritório em Talatona',
    descricao: 'Espaço corporativo, 350m², piso 5',
    tipoCodigo: 'ARRENDAMENTO',
    estado: ContratoEstado.ACTIVO,
    valor: AKZ(2_500_000),  // renda mensal
    moeda: 'AKZ',
    valorEmAKZ: AKZ(2_500_000),
    leiAplicavel: 'Lei angolana',
    foro: 'Tribunal Provincial de Luanda',
    dataAssinatura: '2024-12-01',
    dataInicioVigencia: '2025-01-01',
    dataTermo: '2027-12-31',
    renovacaoAutomatica: true,
    janelaDenunciaDias: 90,
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 6, papel: PartePapel.CONTRAPARTE },  // Imobiliária Talatona
    ],
    datasChave: [
      { tipo: DataChaveTipo.TERMO, data: '2027-12-31' },
      { tipo: DataChaveTipo.REVISAO_PRECO, data: '2026-12-01', descricao: 'Revisão anual' },
    ],
    avaliarCompliance: true,
  },

  // ─── 3. Fornecimento (ACTIVO, expira em 30 dias — CRÍTICO) ─
  {
    numeroInterno: 'CT-2026-D0003',
    titulo: 'Fornecimento de equipamento industrial',
    tipoCodigo: 'FORNECIMENTO',
    estado: ContratoEstado.ACTIVO,
    valor: AKZ(45_000_000),
    moeda: 'AKZ',
    valorEmAKZ: AKZ(45_000_000),
    leiAplicavel: 'Lei angolana',
    dataAssinatura: '2025-07-20',
    dataTermo: '2026-07-21',  // <30 dias!
    renovacaoAutomatica: false,
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 5, papel: PartePapel.CONTRAPARTE },
    ],
    datasChave: [
      { tipo: DataChaveTipo.TERMO, data: '2026-07-21', descricao: 'Termo natural — não renova' },
    ],
    avaliarCompliance: true,
  },

  // ─── 4. NDA (REPOSITORIO, sem valor) ─────────────────────
  {
    numeroInterno: 'CT-2026-D0004',
    titulo: 'NDA — Discussões preliminares de M&A',
    tipoCodigo: 'NDA',
    estado: ContratoEstado.REPOSITORIO,
    leiAplicavel: 'Lei angolana',
    foro: 'CACL — Centro de Arbitragem',
    dataAssinatura: '2026-03-10',
    dataTermo: '2028-03-10',
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 0, papel: PartePapel.CONTRAPARTE },
    ],
    avaliarCompliance: true,
  },

  // ─── 5. Mútuo bancário (ACTIVO) ──────────────────────────
  {
    numeroInterno: 'CT-2026-D0005',
    titulo: 'Linha de crédito BFA — capital de giro',
    tipoCodigo: 'MUTUO',
    estado: ContratoEstado.ACTIVO,
    valor: AKZ(100_000_000),
    moeda: 'AKZ',
    valorEmAKZ: AKZ(100_000_000),
    leiAplicavel: 'Lei angolana',
    dataAssinatura: '2025-11-15',
    dataInicioVigencia: '2025-11-20',
    dataTermo: '2027-11-15',
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 2, papel: PartePapel.CONTRAPARTE },  // BFA
    ],
    datasChave: [
      { tipo: DataChaveTipo.PAGAMENTO, data: '2026-08-15', descricao: 'Tranche trimestral' },
      { tipo: DataChaveTipo.PAGAMENTO, data: '2026-11-15', descricao: 'Tranche trimestral' },
    ],
    avaliarCompliance: true,
  },

  // ─── 6. Contrato de trabalho ─────────────────────────────
  {
    numeroInterno: 'CT-2026-D0006',
    titulo: 'Contrato de trabalho — Director Jurídico',
    tipoCodigo: 'TRABALHO_EXECUTIVO',
    estado: ContratoEstado.ACTIVO,
    valor: AKZ(1_200_000),  // mensal
    moeda: 'AKZ',
    valorEmAKZ: AKZ(1_200_000),
    leiAplicavel: 'Lei n.º 7/15 (LGT)',
    dataAssinatura: '2024-03-01',
    dataInicioVigencia: '2024-03-15',
    prazoIndeterminado: true,
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 3, papel: PartePapel.CONTRAPARTE },  // pessoa singular
    ],
    avaliarCompliance: true,
  },

  // ─── 7. Em negociação (drafting/redlining) ──────────────
  {
    numeroInterno: 'CT-2026-D0007',
    titulo: 'Joint Venture — exploração offshore Bloco 17',
    tipoCodigo: 'PRESTACAO_SERVICOS',
    estado: ContratoEstado.EM_NEGOCIACAO,
    valor: USD(5_000_000),
    moeda: 'USD',
    valorEmAKZ: AKZ(4_250_000_000),
    leiAplicavel: 'Lei inglesa',
    foro: 'LCIA — London Court of International Arbitration',
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 0, papel: PartePapel.CONTRAPARTE },  // TotalEnergies
      { entidadeIndex: 1, papel: PartePapel.CONTRAPARTE },  // Sonangás
    ],
  },

  // ─── 8. Em drafting (intake fresco) ─────────────────────
  {
    numeroInterno: 'CT-2026-D0008',
    titulo: 'Acordo de prestação de serviços de consultoria fiscal',
    tipoCodigo: 'CONSULTORIA',
    estado: ContratoEstado.DRAFTING,
    valor: AKZ(8_000_000),
    moeda: 'AKZ',
    valorEmAKZ: AKZ(8_000_000),
    leiAplicavel: 'Lei angolana',
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
    ],
  },

  // ─── 9. Terminado (histórico recente) ───────────────────
  {
    numeroInterno: 'CT-2026-D0009',
    titulo: 'Contrato de manutenção 2024 (terminado)',
    tipoCodigo: 'PRESTACAO_SERVICOS',
    estado: ContratoEstado.TERMINADO,
    valor: AKZ(15_000_000),
    moeda: 'AKZ',
    valorEmAKZ: AKZ(15_000_000),
    leiAplicavel: 'Lei angolana',
    dataAssinatura: '2024-01-15',
    dataInicioVigencia: '2024-02-01',
    dataTermo: '2025-01-31',
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 5, papel: PartePapel.CONTRAPARTE },
    ],
  },

  // ─── 10. Compra e venda de imóvel (POS_ASSINATURA — registos pendentes) ─
  {
    numeroInterno: 'CT-2026-D0010',
    titulo: 'Compra e venda — Apartamento Marginal',
    tipoCodigo: 'COMPRAVENDA_IMOVEL',
    estado: ContratoEstado.POS_ASSINATURA,
    valor: AKZ(250_000_000),
    moeda: 'AKZ',
    valorEmAKZ: AKZ(250_000_000),
    leiAplicavel: 'Lei angolana',
    dataAssinatura: '2026-06-10',
    dataInicioVigencia: '2026-06-10',
    partes: [
      { entidadeIndex: 'SELF', papel: PartePapel.PARTE_PRINCIPAL },
      { entidadeIndex: 3, papel: PartePapel.CONTRAPARTE },  // pessoa singular vendedor
    ],
    avaliarCompliance: true,
  },
];
