import {
  ActoRegulatorioTipo,
  ComplianceContext,
} from '@kamaia/shared-types';
import { DISCLAIMER_PADRAO, RegraCompliance } from '../types';

export const REGRA_REGISTO_PREDIAL: RegraCompliance = {
  id: 'REGISTO_PREDIAL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.REGISTO_PREDIAL,
  referenciaLegal:
    'Código do Registo Predial. Actos que envolvam constituição, ' +
    'modificação ou extinção de direitos reais sobre imóveis devem ' +
    'ser registados na Conservatória do Registo Predial competente.',
  disclaimer:
    DISCLAIMER_PADRAO +
    ' O registo é normalmente requisito de oponibilidade a terceiros ' +
    'e, em alguns casos, requisito de validade.',
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) => ctx.hasObjectoImovel,
  build: () => ({
    observacoes:
      'Submeta para registo na Conservatória do Registo Predial ' +
      'da área do imóvel. Documentos: contrato + comprovativos fiscais.',
  }),
};

export const REGRA_REGISTO_COMERCIAL: RegraCompliance = {
  id: 'REGISTO_COMERCIAL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.REGISTO_COMERCIAL,
  referenciaLegal:
    'Código do Registo Comercial. Actos societários (alterações ao ' +
    'pacto social, fusões, cisões, transformações) carecem de registo.',
  disclaimer: DISCLAIMER_PADRAO,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) => ctx.hasObjectoSocietario,
  build: () => ({
    observacoes:
      'Registo no Guiché Único da Empresa / Conservatória do Registo Comercial.',
  }),
};

export const REGRA_REGISTO_AUTOMOVEL: RegraCompliance = {
  id: 'REGISTO_AUTOMOVEL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.REGISTO_AUTOMOVEL,
  referenciaLegal:
    'Regime jurídico do registo automóvel. Transmissão de propriedade ' +
    'de veículos automóveis carece de registo.',
  disclaimer: DISCLAIMER_PADRAO,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) => ctx.hasObjectoAutomovel,
  build: () => ({
    observacoes:
      'Apresente o contrato + documentos do veículo à Conservatória ' +
      'do Registo Automóvel competente.',
  }),
};

export const REGRA_REGISTO_IP: RegraCompliance = {
  id: 'REGISTO_IP_IAPI',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.REGISTO_IP_IAPI,
  referenciaLegal:
    'Lei da Propriedade Industrial. Cessões e licenças de direitos de ' +
    'propriedade industrial podem requerer averbamento no IAPI ' +
    '(Instituto Angolano da Propriedade Industrial).',
  disclaimer: DISCLAIMER_PADRAO,
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) => ctx.hasObjectoIP,
  build: () => ({
    observacoes:
      'Verifique a necessidade de averbamento da cessão / licença ' +
      'junto do IAPI para oponibilidade a terceiros.',
  }),
};

export const REGRAS_REGISTOS: RegraCompliance[] = [
  REGRA_REGISTO_PREDIAL,
  REGRA_REGISTO_COMERCIAL,
  REGRA_REGISTO_AUTOMOVEL,
  REGRA_REGISTO_IP,
];
