import {
  ActoRegulatorioTipo,
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { DISCLAIMER_PADRAO, RegraCompliance } from '../types';

/**
 * Retenção na fonte de IRT sobre serviços prestados por não-residentes
 * (regime corrente). A retenção é devida pelo pagador residente em
 * Angola sobre rendimentos pagos a não-residentes.
 */
export const REGRA_AGT_RETENCAO_IRT_NAO_RESIDENTE: RegraCompliance = {
  id: 'AGT_RETENCAO_IRT_NAO_RESIDENTE',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.AGT_RETENCAO_IRT,
  referenciaLegal:
    'Código do IRT — regime aplicável a rendimentos pagos a não-residentes. ' +
    'Taxa e regras vigentes devem ser confirmadas com a AGT.',
  disclaimer:
    DISCLAIMER_PADRAO +
    ' A retenção na fonte é obrigação do pagador residente. ' +
    'A taxa aplicável e regime concreto dependem da natureza do rendimento ' +
    'e de eventual convenção para evitar dupla tributação.',
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) => {
    if (ctx.categoria !== TipoContratoCategoria.SERVICOS) return false;
    return ctx.partesResidentes.some((r) => !r);
  },
  build: () => ({
    observacoes:
      'Calcule e retenha o IRT devido no momento de cada pagamento. ' +
      'Entrega à AGT mensalmente até ao dia legal do mês seguinte. ' +
      'Verifique convenção para evitar dupla tributação aplicável ao país de residência.',
  }),
};

export const REGRAS_AGT: RegraCompliance[] = [
  REGRA_AGT_RETENCAO_IRT_NAO_RESIDENTE,
];
