import {
  CONTRATO_TRANSITIONS,
  ContratoEstado,
  canTransition,
} from '@kamaia/shared-types';

describe('Contrato state machine', () => {
  // ─── Modo A — Drafting full ─────────────────────────────
  describe('Modo A (drafting full)', () => {
    it('permite o fluxo canónico INTAKE → ARQUIVADO', () => {
      const fluxo: ContratoEstado[] = [
        ContratoEstado.INTAKE,
        ContratoEstado.DRAFTING,
        ContratoEstado.REV_INTERNA,
        ContratoEstado.REV_CLIENTE,
        ContratoEstado.EM_NEGOCIACAO,
        ContratoEstado.APROVACAO,
        ContratoEstado.PRONTO_ASSINATURA,
        ContratoEstado.ASSINADO,
        ContratoEstado.POS_ASSINATURA,
        ContratoEstado.ACTIVO,
        ContratoEstado.EM_TERMINACAO,
        ContratoEstado.TERMINADO,
        ContratoEstado.ARQUIVADO,
      ];
      for (let i = 0; i < fluxo.length - 1; i++) {
        expect(canTransition(fluxo[i], fluxo[i + 1])).toBe(true);
      }
    });
  });

  // ─── Modo B — Review da contraparte ─────────────────────
  describe('Modo B (review da contraparte)', () => {
    it('INTAKE → EM_NEGOCIACAO (salta drafting)', () => {
      expect(canTransition(ContratoEstado.INTAKE, ContratoEstado.EM_NEGOCIACAO)).toBe(true);
    });
  });

  // ─── Modo C — Repositório ──────────────────────────────
  describe('Modo C (repositório)', () => {
    it('INTAKE → REPOSITORIO permitido (importação em massa)', () => {
      expect(canTransition(ContratoEstado.INTAKE, ContratoEstado.REPOSITORIO)).toBe(true);
    });
    it('REPOSITORIO → ACTIVO ou ARQUIVADO', () => {
      expect(canTransition(ContratoEstado.REPOSITORIO, ContratoEstado.ACTIVO)).toBe(true);
      expect(canTransition(ContratoEstado.REPOSITORIO, ContratoEstado.ARQUIVADO)).toBe(true);
    });
  });

  // ─── Loops permitidos ──────────────────────────────────
  describe('Loops permitidos', () => {
    it('EM_NEGOCIACAO auto-loop (nova versão da contraparte)', () => {
      expect(canTransition(ContratoEstado.EM_NEGOCIACAO, ContratoEstado.EM_NEGOCIACAO)).toBe(true);
    });
    it('REV_INTERNA pode voltar para DRAFTING (sócio devolve a júnior)', () => {
      expect(canTransition(ContratoEstado.REV_INTERNA, ContratoEstado.DRAFTING)).toBe(true);
    });
    it('REV_CLIENTE pode voltar para DRAFTING (cliente exige mudanças)', () => {
      expect(canTransition(ContratoEstado.REV_CLIENTE, ContratoEstado.DRAFTING)).toBe(true);
    });
    it('EM_NEGOCIACAO pode voltar a REV_CLIENTE (consultar cliente antes de fechar)', () => {
      expect(canTransition(ContratoEstado.EM_NEGOCIACAO, ContratoEstado.REV_CLIENTE)).toBe(true);
    });
    it('APROVACAO pode voltar a EM_NEGOCIACAO (falhou KYC, renegociar)', () => {
      expect(canTransition(ContratoEstado.APROVACAO, ContratoEstado.EM_NEGOCIACAO)).toBe(true);
    });
    it('PRONTO_ASSINATURA pode voltar a APROVACAO', () => {
      expect(canTransition(ContratoEstado.PRONTO_ASSINATURA, ContratoEstado.APROVACAO)).toBe(true);
    });
    it('ACTIVO renovação auto re-entra em ACTIVO', () => {
      expect(canTransition(ContratoEstado.ACTIVO, ContratoEstado.ACTIVO)).toBe(true);
    });
  });

  // ─── Skips ilegais ─────────────────────────────────────
  describe('Transições ilegais (skips típicos)', () => {
    const ilegais: Array<[ContratoEstado, ContratoEstado]> = [
      [ContratoEstado.INTAKE, ContratoEstado.ASSINADO],     // saltar review e negociação
      [ContratoEstado.DRAFTING, ContratoEstado.ACTIVO],     // saltar tudo
      [ContratoEstado.ASSINADO, ContratoEstado.ACTIVO],     // saltar POS_ASSINATURA (compliance)
      [ContratoEstado.ASSINADO, ContratoEstado.TERMINADO],  // saltar vida activa
      [ContratoEstado.ACTIVO, ContratoEstado.TERMINADO],    // tem de passar por EM_TERMINACAO
      [ContratoEstado.TERMINADO, ContratoEstado.ACTIVO],    // ressuscitar
      [ContratoEstado.ARQUIVADO, ContratoEstado.ACTIVO],    // ressuscitar arquivado
      [ContratoEstado.ARQUIVADO, ContratoEstado.DRAFTING],  // ressuscitar arquivado
      [ContratoEstado.CANCELADO, ContratoEstado.DRAFTING],  // re-abrir cancelado
      [ContratoEstado.CANCELADO, ContratoEstado.ACTIVO],    // re-abrir cancelado
    ];
    it.each(ilegais)('%s → %s é rejeitada', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  // ─── CANCELADO como absorvedor ─────────────────────────
  describe('CANCELADO absorve estados pré-ASSINADO', () => {
    const preAssinado: ContratoEstado[] = [
      ContratoEstado.INTAKE,
      ContratoEstado.DRAFTING,
      ContratoEstado.REV_INTERNA,
      ContratoEstado.REV_CLIENTE,
      ContratoEstado.EM_NEGOCIACAO,
      ContratoEstado.APROVACAO,
      ContratoEstado.PRONTO_ASSINATURA,
    ];
    it.each(preAssinado)('%s → CANCELADO', (estado) => {
      expect(canTransition(estado, ContratoEstado.CANCELADO)).toBe(true);
    });
    it('ASSINADO não pode ser CANCELADO (já tem efeitos)', () => {
      expect(canTransition(ContratoEstado.ASSINADO, ContratoEstado.CANCELADO)).toBe(false);
    });
    it('ACTIVO não pode ser CANCELADO — só TERMINADO via EM_TERMINACAO', () => {
      expect(canTransition(ContratoEstado.ACTIVO, ContratoEstado.CANCELADO)).toBe(false);
    });
  });

  // ─── Estados terminais ─────────────────────────────────
  describe('Estados terminais', () => {
    it('ARQUIVADO não tem transições de saída', () => {
      expect(CONTRATO_TRANSITIONS[ContratoEstado.ARQUIVADO]).toEqual([]);
    });
    it('CANCELADO não tem transições de saída', () => {
      expect(CONTRATO_TRANSITIONS[ContratoEstado.CANCELADO]).toEqual([]);
    });
  });

  // ─── Sanidade: cobertura completa ───────────────────────
  describe('Sanidade', () => {
    it('todos os estados têm entrada na tabela de transições', () => {
      const declarados = Object.values(ContratoEstado);
      const tabelados = Object.keys(CONTRATO_TRANSITIONS);
      expect(new Set(tabelados)).toEqual(new Set(declarados));
    });
    it('canTransition para par desconhecido retorna false (defensive)', () => {
      expect(
        canTransition('NAO_EXISTE' as ContratoEstado, ContratoEstado.ACTIVO),
      ).toBe(false);
    });
  });
});
