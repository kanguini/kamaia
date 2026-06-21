import {
  ActoRegulatorioTipo,
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { DISCLAIMER_PADRAO, RegraCompliance } from '../types';

/**
 * Regras BNA — Lei Cambial e RJOC (Regime Jurídico das Operações Cambiais).
 *
 * Operações cambiais com não-residentes podem requerer:
 *  - Autorização prévia BNA (acima de certos limites)
 *  - Registo na BNA via banco comercial autorizado
 *
 * Os limiares variam por tipo de operação e por aviso BNA vigente.
 * Confirme sempre o aviso aplicável à data da operação.
 */

const LIMIAR_USD_AUTORIZACAO = BigInt(50_000_00); // USD 50k em centavos — indicativo
const LIMIAR_USD_REGISTO = BigInt(10_000_00);     // USD 10k em centavos — indicativo

function temNaoResidente(ctx: ComplianceContext): boolean {
  return ctx.partesResidentes.some((r) => !r);
}

function valorEmUSDOuEquivalente(ctx: ComplianceContext): bigint | null {
  if (!ctx.valor) return null;
  if (ctx.moeda === 'USD') return ctx.valor;
  // Para outras moedas, usar valorEmAKZ → conversão indicativa USD ≈ 850 AKZ
  // (valor real seria injectado via taxa de câmbio de referência BNA)
  if (ctx.valorEmAKZ) return ctx.valorEmAKZ / 850n;
  return null;
}

export const REGRA_BNA_SERVICOS_NAO_RESIDENTE: RegraCompliance = {
  id: 'BNA_SERVICOS_NAO_RESIDENTE',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.BNA_AUTORIZACAO,
  referenciaLegal:
    'Lei Cambial + RJOC + Avisos BNA aplicáveis a operações cambiais ' +
    'de prestação de serviços com não-residentes. Confirme o aviso ' +
    'em vigor à data da operação.',
  disclaimer:
    DISCLAIMER_PADRAO +
    ' Operações cambiais com não-residentes acima de certos limites ' +
    'requerem autorização prévia do BNA via banco comercial autorizado.',
  vigenteDesde: new Date('2026-01-01'),
  aplicaSe: (ctx: ComplianceContext) => {
    if (!temNaoResidente(ctx)) return false;
    if (ctx.categoria !== TipoContratoCategoria.SERVICOS) return false;
    const usd = valorEmUSDOuEquivalente(ctx);
    return usd !== null && usd >= LIMIAR_USD_AUTORIZACAO;
  },
  build: () => ({
    prazoLimite: undefined,  // pré-assinatura
    observacoes:
      'Submeta o pedido ao seu banco comercial autorizado antes da ' +
      'celebração / pagamento da operação. Documentos típicos: ' +
      'contrato, factura, comprovativo de objecto e justificação cambial.',
  }),
};

export const REGRA_BNA_MUTUO_INTERNACIONAL: RegraCompliance = {
  id: 'BNA_MUTUO_INTERNACIONAL',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.BNA_AUTORIZACAO,
  referenciaLegal:
    'Lei Cambial + RJOC — operações de capital. Mútuos transfronteiriços ' +
    'estão sujeitos a regime cambial específico.',
  disclaimer:
    DISCLAIMER_PADRAO +
    ' Mútuos com não-residentes requerem normalmente autorização BNA e ' +
    'estruturação cambial específica.',
  vigenteDesde: new Date('2026-01-01'),
  aplicaSe: (ctx: ComplianceContext) =>
    ctx.tipoCodigo === 'MUTUO' && temNaoResidente(ctx),
  build: () => ({
    observacoes:
      'Operação de capital sujeita a regime cambial específico. ' +
      'Coordene com banco autorizado para estruturação da operação ' +
      'e repatriação de juros e capital.',
  }),
};

export const REGRA_BNA_REGISTO_SERVICOS_PEQUENO: RegraCompliance = {
  id: 'BNA_REGISTO_SERVICOS_PEQUENO',
  versao: '2026.1',
  tipo: ActoRegulatorioTipo.BNA_REGISTO,
  referenciaLegal:
    'RJOC — operações correntes. Pagamentos a não-residentes abaixo do ' +
    'limiar de autorização ficam sujeitos a registo via banco autorizado.',
  disclaimer: DISCLAIMER_PADRAO,
  vigenteDesde: new Date('2026-01-01'),
  aplicaSe: (ctx: ComplianceContext) => {
    if (!temNaoResidente(ctx)) return false;
    if (ctx.categoria !== TipoContratoCategoria.SERVICOS) return false;
    const usd = valorEmUSDOuEquivalente(ctx);
    return (
      usd !== null &&
      usd >= LIMIAR_USD_REGISTO &&
      usd < LIMIAR_USD_AUTORIZACAO
    );
  },
  build: () => ({
    observacoes:
      'Apresente os documentos da operação ao banco para registo cambial.',
  }),
};

export const REGRAS_BNA: RegraCompliance[] = [
  REGRA_BNA_SERVICOS_NAO_RESIDENTE,
  REGRA_BNA_MUTUO_INTERNACIONAL,
  REGRA_BNA_REGISTO_SERVICOS_PEQUENO,
];
