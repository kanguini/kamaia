import {
  ActoRegulatorioTipo,
  ComplianceContext,
  isMoedaKwanza,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { DISCLAIMER_PADRAO, RegraCompliance } from '../types';

/**
 * Retenção na fonte de IRT sobre serviços prestados por não-residentes.
 *
 * **Taxa actual: 15%** (aumentada de 6,5% no quadro da Reforma Tributária).
 * Aplicável a serviços acidentais prestados por entidades não-residentes
 * a pagadores residentes em Angola.
 *
 * A retenção é obrigação do pagador residente. Entrega à AGT
 * mensalmente até ao último dia útil do mês seguinte.
 */
export const REGRA_AGT_RETENCAO_IRT_NAO_RESIDENTE: RegraCompliance = {
  id: 'AGT_RETENCAO_IRT_NAO_RESIDENTE',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.AGT_RETENCAO_IRT,
  referenciaLegal:
    'Código do IRT — taxa de retenção na fonte de 15% sobre serviços ' +
    'prestados por entidades não-residentes (anteriormente 6,5%; ' +
    'alterada no quadro da Reforma Tributária). Obrigação do pagador ' +
    'residente. Verificar convenção para evitar dupla tributação ' +
    'aplicável ao país de residência do prestador.',
  disclaimer:
    DISCLAIMER_PADRAO +
    ' A retenção na fonte é obrigação do pagador residente. ' +
    'A taxa aplicável e regime concreto dependem da natureza do rendimento ' +
    'e de eventual convenção para evitar dupla tributação.',
  vigenteDesde: new Date('2020-01-01'),
  aplicaSe: (ctx: ComplianceContext) => {
    if (
      ctx.categoria !== TipoContratoCategoria.SERVICOS &&
      ctx.categoria !== TipoContratoCategoria.IP
    ) return false;
    return ctx.partesResidentes.some((r) => !r);
  },
  build: (ctx) => {
    // A retenção entrega-se em KWANZAS — contratos em moeda estrangeira
    // usam o contravalor valorEmAKZ; sem conversão, não se calcula
    // (antes: 15% sobre centavos de USD tratados como AKZ).
    const base = isMoedaKwanza(ctx.moeda) ? ctx.valor : ctx.valorEmAKZ;
    const semConversao =
      !isMoedaKwanza(ctx.moeda) && ctx.valorEmAKZ === null;
    return {
      baseTributavel: base ?? undefined,
      valorLiquidar: base !== null ? (base * 15n) / 100n : undefined,
      observacoes:
        'Reter 15% do valor pago ao não-residente. Entrega à AGT até ao ' +
        'último dia útil do mês seguinte ao do pagamento. Verificar CDT ' +
        'aplicável (e.g. Portugal, Cabo Verde) que pode reduzir a taxa.' +
        (semConversao
          ? ` ATENÇÃO: contrato em ${ctx.moeda} sem contravalor em AKZ — preencher o valor em kwanzas para calcular a retenção.`
          : ''),
    };
  },
};

export const REGRAS_AGT: RegraCompliance[] = [
  REGRA_AGT_RETENCAO_IRT_NAO_RESIDENTE,
];
