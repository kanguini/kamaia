import { Injectable, Logger } from '@nestjs/common';
import {
  ComplianceActoDetectado,
  ComplianceContext,
} from '@kamaia/shared-types';
import { REGRAS_AGT } from './regras/agt-irt';
import { REGRAS_BNA } from './regras/bna';
import { REGRAS_IS } from './regras/imposto-selo';
import { REGRAS_NOTARIO } from './regras/notario';
import { REGRAS_REGISTOS } from './regras/registos';
import { RegraCompliance } from './types';

/**
 * Compliance Engine — avalia regras declarativas contra o contexto de
 * um contrato e devolve a lista de actos regulatórios sugeridos.
 *
 * **Princípio:** O engine sugere, nunca executa. A lei vigente à data
 * do facto é a aplicável — não a data presente.
 *
 * Para adicionar nova regra: criar ficheiro em `regras/` e registá-lo
 * no array `REGRAS_TODAS` abaixo. A regra define `aplicaSe()` (predicado
 * puro sobre o contexto) e `build()` (constrói o acto a sugerir).
 */
@Injectable()
export class ComplianceEngine {
  private readonly logger = new Logger(ComplianceEngine.name);

  private readonly regras: RegraCompliance[] = [
    ...REGRAS_IS,
    ...REGRAS_BNA,
    ...REGRAS_REGISTOS,
    ...REGRAS_AGT,
    ...REGRAS_NOTARIO,
  ];

  /**
   * Avalia todas as regras vigentes à data fornecida (default: hoje)
   * contra o contexto e devolve actos detectados.
   */
  evaluate(
    ctx: ComplianceContext,
    referenceDate: Date = new Date(),
  ): ComplianceActoDetectado[] {
    const detectados: ComplianceActoDetectado[] = [];

    for (const regra of this.regras) {
      if (!this.estaVigente(regra, referenceDate)) continue;

      let aplicaSe: boolean;
      try {
        aplicaSe = regra.aplicaSe(ctx);
      } catch (e) {
        this.logger.error(
          `Regra ${regra.id}@${regra.versao} aplicaSe() falhou: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        continue;
      }
      if (!aplicaSe) continue;

      try {
        const partial = regra.build(ctx);
        detectados.push({
          tipo: regra.tipo,
          regraId: regra.id,
          regraVersao: regra.versao,
          referenciaLegal: regra.referenciaLegal,
          disclaimer: regra.disclaimer,
          ...partial,
        });
      } catch (e) {
        this.logger.error(
          `Regra ${regra.id}@${regra.versao} build() falhou: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    return detectados;
  }

  /** Útil para introspecção / documentação interna. */
  listAllRules(): Array<Pick<RegraCompliance, 'id' | 'versao' | 'tipo' | 'referenciaLegal' | 'vigenteDesde' | 'vigenteAte'>> {
    return this.regras.map((r) => ({
      id: r.id,
      versao: r.versao,
      tipo: r.tipo,
      referenciaLegal: r.referenciaLegal,
      vigenteDesde: r.vigenteDesde,
      vigenteAte: r.vigenteAte,
    }));
  }

  private estaVigente(regra: RegraCompliance, ref: Date): boolean {
    if (regra.vigenteDesde > ref) return false;
    if (regra.vigenteAte && regra.vigenteAte < ref) return false;
    return true;
  }
}
