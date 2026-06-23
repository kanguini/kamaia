import {
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import {
  REGRA_BNA_SERVICOS_NAO_RESIDENTE,
  REGRA_BNA_REGISTO_SERVICOS_PEQUENO,
} from './bna';

/**
 * Locking-down do comportamento BNA por escala monetária — auditor
 * externo expressou dúvida se sub-10k disparava BNA. Estas specs
 * documentam a expectativa correcta:
 *
 *   < USD 10k → nenhuma regra BNA
 *   USD 10k-50k → BNA_REGISTO (registo via banco autorizado)
 *   ≥ USD 50k → BNA_AUTORIZACAO (autorização prévia)
 *
 * Limiares são indicativos (Avisos BNA mudam) e cada acto fica
 * PENDENTE para confirmação humana.
 */

function ctx(usd: bigint, naoResidente = true): ComplianceContext {
  return {
    contratoId: 'c',
    tenantId: 't',
    tipoCodigo: 'PRESTACAO_SERVICOS',
    categoria: TipoContratoCategoria.SERVICOS,
    valor: usd,
    moeda: 'USD',
    valorEmAKZ: null,
    partesResidentes: [true, !naoResidente],
    paisesResidencia: ['AO', naoResidente ? 'PT' : 'AO'],
    leiAplicavel: 'Direito angolano',
    hasObjectoImovel: false,
    hasObjectoAutomovel: false,
    hasObjectoIP: false,
    hasObjectoSocietario: false,
  };
}

describe('Regras BNA — limiares', () => {
  it('< USD 10k não dispara NENHUMA regra BNA (operação corrente isenta)', () => {
    const c = ctx(BigInt(5_000_00)); // USD 5k
    expect(REGRA_BNA_REGISTO_SERVICOS_PEQUENO.aplicaSe(c)).toBe(false);
    expect(REGRA_BNA_SERVICOS_NAO_RESIDENTE.aplicaSe(c)).toBe(false);
  });

  it('USD 10k exacto: dispara apenas BNA_REGISTO', () => {
    const c = ctx(BigInt(10_000_00));
    expect(REGRA_BNA_REGISTO_SERVICOS_PEQUENO.aplicaSe(c)).toBe(true);
    expect(REGRA_BNA_SERVICOS_NAO_RESIDENTE.aplicaSe(c)).toBe(false);
  });

  it('USD 30k: dispara apenas BNA_REGISTO', () => {
    const c = ctx(BigInt(30_000_00));
    expect(REGRA_BNA_REGISTO_SERVICOS_PEQUENO.aplicaSe(c)).toBe(true);
    expect(REGRA_BNA_SERVICOS_NAO_RESIDENTE.aplicaSe(c)).toBe(false);
  });

  it('USD 50k exacto: dispara BNA_AUTORIZACAO (não REGISTO)', () => {
    const c = ctx(BigInt(50_000_00));
    expect(REGRA_BNA_REGISTO_SERVICOS_PEQUENO.aplicaSe(c)).toBe(false);
    expect(REGRA_BNA_SERVICOS_NAO_RESIDENTE.aplicaSe(c)).toBe(true);
  });

  it('USD 100k: dispara BNA_AUTORIZACAO', () => {
    const c = ctx(BigInt(100_000_00));
    expect(REGRA_BNA_SERVICOS_NAO_RESIDENTE.aplicaSe(c)).toBe(true);
  });

  it('Sem não-residente: nenhuma regra mesmo a USD 100k', () => {
    const c = ctx(BigInt(100_000_00), false);
    expect(REGRA_BNA_REGISTO_SERVICOS_PEQUENO.aplicaSe(c)).toBe(false);
    expect(REGRA_BNA_SERVICOS_NAO_RESIDENTE.aplicaSe(c)).toBe(false);
  });
});
