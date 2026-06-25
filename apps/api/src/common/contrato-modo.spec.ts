/**
 * Tests do mapping estado técnico → estado visível → modo da UI.
 *
 * Vive em apps/api porque packages/shared-types não tem jest setup
 * próprio. Importa via path-map `@kamaia/shared-types`. Não tem
 * dependências da API — pode mudar de sítio se shared-types ganhar
 * a sua suite no futuro.
 */
import {
  ContratoEstado,
  contratoModo,
  contratoFlags,
  userVisibleEstado,
  CONTRATO_FLAG_LABELS,
  CONTRATO_ESTADO_VISIVEL_LABELS,
} from '@kamaia/shared-types';

describe('userVisibleEstado — colapso 14 → 6 estados', () => {
  it('agrupa INTAKE/DRAFTING/REV_INTERNA como RASCUNHO', () => {
    expect(userVisibleEstado(ContratoEstado.INTAKE)).toBe('RASCUNHO');
    expect(userVisibleEstado(ContratoEstado.DRAFTING)).toBe('RASCUNHO');
    expect(userVisibleEstado(ContratoEstado.REV_INTERNA)).toBe('RASCUNHO');
  });

  it('agrupa REV_CLIENTE/EM_NEGOCIACAO como EM_REVISAO', () => {
    expect(userVisibleEstado(ContratoEstado.REV_CLIENTE)).toBe('EM_REVISAO');
    expect(userVisibleEstado(ContratoEstado.EM_NEGOCIACAO)).toBe('EM_REVISAO');
  });

  it('agrupa ASSINADO/POS_ASSINATURA/ACTIVO/REPOSITORIO + flags como ACTIVO', () => {
    expect(userVisibleEstado(ContratoEstado.ASSINADO)).toBe('ACTIVO');
    expect(userVisibleEstado(ContratoEstado.POS_ASSINATURA)).toBe('ACTIVO');
    expect(userVisibleEstado(ContratoEstado.ACTIVO)).toBe('ACTIVO');
    expect(userVisibleEstado(ContratoEstado.REPOSITORIO)).toBe('ACTIVO');
    expect(userVisibleEstado(ContratoEstado.EM_DISPUTA)).toBe('ACTIVO');
    expect(userVisibleEstado(ContratoEstado.EM_ADENDA)).toBe('ACTIVO');
    expect(userVisibleEstado(ContratoEstado.EM_TERMINACAO)).toBe('ACTIVO');
  });

  it('agrupa TERMINADO/ARQUIVADO/CANCELADO como ENCERRADO', () => {
    expect(userVisibleEstado(ContratoEstado.TERMINADO)).toBe('ENCERRADO');
    expect(userVisibleEstado(ContratoEstado.ARQUIVADO)).toBe('ENCERRADO');
    expect(userVisibleEstado(ContratoEstado.CANCELADO)).toBe('ENCERRADO');
  });

  it('isola APROVACAO e PRONTO_ASSINATURA como estados próprios', () => {
    expect(userVisibleEstado(ContratoEstado.APROVACAO)).toBe('APROVACAO');
    expect(userVisibleEstado(ContratoEstado.PRONTO_ASSINATURA)).toBe('A_ASSINAR');
  });

  it('tem labels para os 6 estados visíveis', () => {
    expect(CONTRATO_ESTADO_VISIVEL_LABELS.RASCUNHO).toBe('Rascunho');
    expect(CONTRATO_ESTADO_VISIVEL_LABELS.A_ASSINAR).toBe('A assinar');
    expect(CONTRATO_ESTADO_VISIVEL_LABELS.ENCERRADO).toBe('Encerrado');
  });
});

describe('contratoModo — UI mode dispatch', () => {
  it('RASCUNHO/EM_REVISAO/APROVACAO → DRAFTING (foco editor)', () => {
    expect(contratoModo(ContratoEstado.INTAKE)).toBe('DRAFTING');
    expect(contratoModo(ContratoEstado.DRAFTING)).toBe('DRAFTING');
    expect(contratoModo(ContratoEstado.REV_CLIENTE)).toBe('DRAFTING');
    expect(contratoModo(ContratoEstado.EM_NEGOCIACAO)).toBe('DRAFTING');
    expect(contratoModo(ContratoEstado.APROVACAO)).toBe('DRAFTING');
  });

  it('A_ASSINAR → SIGNATURE (foco wizard de assinatura)', () => {
    expect(contratoModo(ContratoEstado.PRONTO_ASSINATURA)).toBe('SIGNATURE');
  });

  it('ACTIVO → REPOSITORY (foco resumo + PDF)', () => {
    expect(contratoModo(ContratoEstado.ACTIVO)).toBe('REPOSITORY');
    expect(contratoModo(ContratoEstado.REPOSITORIO)).toBe('REPOSITORY');
    expect(contratoModo(ContratoEstado.EM_DISPUTA)).toBe('REPOSITORY');
  });

  it('ENCERRADO → CLOSED (read-only)', () => {
    expect(contratoModo(ContratoEstado.TERMINADO)).toBe('CLOSED');
    expect(contratoModo(ContratoEstado.ARQUIVADO)).toBe('CLOSED');
    expect(contratoModo(ContratoEstado.CANCELADO)).toBe('CLOSED');
  });
});

describe('contratoFlags — situações transversais', () => {
  it('extrai EM_DISPUTA quando estado é EM_DISPUTA', () => {
    expect(contratoFlags(ContratoEstado.EM_DISPUTA)).toEqual(['EM_DISPUTA']);
  });

  it('extrai EM_ADENDA quando estado é EM_ADENDA', () => {
    expect(contratoFlags(ContratoEstado.EM_ADENDA)).toEqual(['EM_ADENDA']);
  });

  it('extrai REPOSITORIO como flag (não estado primário)', () => {
    expect(contratoFlags(ContratoEstado.REPOSITORIO)).toEqual(['REPOSITORIO']);
  });

  it('não devolve flags para estados normais', () => {
    expect(contratoFlags(ContratoEstado.ACTIVO)).toEqual([]);
    expect(contratoFlags(ContratoEstado.DRAFTING)).toEqual([]);
    expect(contratoFlags(ContratoEstado.TERMINADO)).toEqual([]);
  });

  it('tem labels humanos para todas as flags', () => {
    expect(CONTRATO_FLAG_LABELS.EM_DISPUTA).toBe('Em disputa');
    expect(CONTRATO_FLAG_LABELS.REPOSITORIO).toBe('Importado');
  });
});

describe('Coerência semântica', () => {
  it('estados ACTIVO* mantêm modo REPOSITORY E label visível ACTIVO', () => {
    // Garantia de consistência: o resultado de userVisibleEstado e o
    // de contratoModo não pode divergir entre si.
    const estados = [
      ContratoEstado.ASSINADO,
      ContratoEstado.POS_ASSINATURA,
      ContratoEstado.ACTIVO,
      ContratoEstado.REPOSITORIO,
      ContratoEstado.EM_DISPUTA,
      ContratoEstado.EM_ADENDA,
      ContratoEstado.EM_TERMINACAO,
    ];
    for (const e of estados) {
      expect(userVisibleEstado(e)).toBe('ACTIVO');
      expect(contratoModo(e)).toBe('REPOSITORY');
    }
  });
});
