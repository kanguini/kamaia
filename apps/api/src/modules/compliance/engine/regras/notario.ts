import {
  ActoRegulatorioTipo,
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { DISCLAIMER_PADRAO, RegraCompliance } from '../types';

/**
 * Reconhecimento notarial obrigatório por lei em certos actos —
 * tipicamente compra e venda de imóveis, doações, alterações ao pacto
 * social, procurações para certos fins, e outros expressamente
 * previstos na lei.
 */
export const REGRA_NOTARIO_COMPRAVENDA_IMOVEL: RegraCompliance = {
  id: 'NOTARIO_COMPRAVENDA_IMOVEL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.RECONHECIMENTO_NOTARIAL,
  referenciaLegal:
    'Código do Notariado. Compra e venda de imóveis carece de escritura ' +
    'pública ou documento autenticado (consoante o regime aplicável).',
  disclaimer: DISCLAIMER_PADRAO,
  vigenteDesde: new Date('2026-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.categoria === TipoContratoCategoria.IMOBILIARIO &&
    ctx.tipoCodigo === 'COMPRAVENDA_IMOVEL',
  build: () => ({
    observacoes:
      'Agende escritura pública em cartório notarial competente. ' +
      'Apresente: identidade das partes, documentos do imóvel, ' +
      'comprovativos fiscais (IS / SISA).',
  }),
};

export const REGRA_NOTARIO_PACTO_SOCIAL: RegraCompliance = {
  id: 'NOTARIO_PACTO_SOCIAL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.RECONHECIMENTO_NOTARIAL,
  referenciaLegal:
    'Código do Notariado + Lei das Sociedades Comerciais. Alterações ao ' +
    'pacto social carecem de forma legal específica.',
  disclaimer: DISCLAIMER_PADRAO,
  vigenteDesde: new Date('2026-01-01'),
  aplicaSe: (ctx: ComplianceContext) => ctx.hasObjectoSocietario,
  build: () => ({
    observacoes:
      'Verifique o tipo de acto e a forma legal exigida (escritura pública, ' +
      'documento autenticado ou particular com reconhecimento).',
  }),
};

export const REGRAS_NOTARIO: RegraCompliance[] = [
  REGRA_NOTARIO_COMPRAVENDA_IMOVEL,
  REGRA_NOTARIO_PACTO_SOCIAL,
];
