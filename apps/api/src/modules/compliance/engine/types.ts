import {
  ActoRegulatorioTipo,
  ComplianceActoDetectado,
  ComplianceContext,
} from '@kamaia/shared-types';

/**
 * Regra declarativa do Compliance Engine.
 *
 * Cada regra é versionada e tem referência legal explícita — a versão
 * vigente à data do facto tributário é a que se aplica, não a data
 * presente. Isto permite que actos antigos preservem o regime que se
 * aplicava na altura.
 *
 * O engine apenas SUGERE actos; cada acto entra como PENDENTE no
 * Contrato e exige confirmação humana antes de ser considerado resolvido.
 */
export interface RegraCompliance {
  id: string;
  versao: string;
  tipo: ActoRegulatorioTipo;
  referenciaLegal: string;
  disclaimer: string;
  vigenteDesde: Date;
  vigenteAte?: Date;
  /** Aplica-se ao contrato? */
  aplicaSe(ctx: ComplianceContext): boolean;
  /** Constrói o acto detectado. */
  build(ctx: ComplianceContext): Omit<ComplianceActoDetectado, 'tipo' | 'regraId' | 'regraVersao' | 'referenciaLegal' | 'disclaimer'>;
}

export const DISCLAIMER_PADRAO =
  'Acto sugerido pelo Compliance Engine com base em regras pré-configuradas. ' +
  'A interpretação da lei aplicável depende do caso concreto. ' +
  'Confirme com o responsável jurídico antes de submeter ou liquidar. ' +
  'O Kamaia não substitui aconselhamento legal profissional.';

export const DISCLAIMER_IS =
  DISCLAIMER_PADRAO +
  ' A liquidação do Imposto de Selo deve ser feita junto da AGT no prazo legal; ' +
  'multas e juros por liquidação fora de prazo são da responsabilidade do contribuinte.';
