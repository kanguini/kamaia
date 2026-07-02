import {
  ActoRegulatorioTipo,
  ComplianceContext,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { ComplianceEngine } from './compliance.engine';

/**
 * Suite que valida que o ComplianceEngine sugere os actos certos para
 * os cenários típicos. Garante regressão zero quando se adicionarem
 * novas regras ou se evoluir o domínio.
 */
describe('ComplianceEngine', () => {
  const engine = new ComplianceEngine();

  function ctxBase(overrides: Partial<ComplianceContext> = {}): ComplianceContext {
    return {
      contratoId: 'c-1',
      tenantId: 't-1',
      tipoCodigo: 'PRESTACAO_SERVICOS',
      categoria: TipoContratoCategoria.SERVICOS,
      valor: BigInt(10_000_000_00),  // AKZ 10M
      moeda: 'AKZ',
      valorEmAKZ: BigInt(10_000_000_00),
      dataAssinatura: null,
      partesResidentes: [true, true],
      paisesResidencia: ['AO', 'AO'],
      leiAplicavel: 'Angola',
      hasObjectoImovel: false,
      hasObjectoAutomovel: false,
      hasObjectoIP: false,
      hasObjectoSocietario: false,
      ...overrides,
    };
  }

  // ─── IS — Imposto de Selo ────────────────────────────────
  describe('Imposto de Selo (TGIS — Decreto Legislativo Presidencial 3/14)', () => {
    it('prestação de serviços dispara Verba 23.3 (7%)', () => {
      const actos = engine.evaluate(ctxBase());
      const is = actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS');
      expect(is).toBeDefined();
      expect(is!.tipo).toBe(ActoRegulatorioTipo.IMPOSTO_SELO);
      expect(is!.tgisVerbaNumero).toBe('23.3');
      expect(is!.valorLiquidar).toBe((BigInt(10_000_000_00) * 7n) / 100n);
      expect(is!.referenciaLegal).toMatch(/Verba 23\.3.+3\/14/);
    });

    it('arrendamento comercial (cód ARRENDAMENTO) dispara Verba 2.2 (0,4%)', () => {
      const actos = engine.evaluate(
        ctxBase({
          categoria: TipoContratoCategoria.IMOBILIARIO,
          tipoCodigo: 'ARRENDAMENTO',
        }),
      );
      const is = actos.find((a) => a.regraId === 'IS_ARRENDAMENTO_COMERCIAL');
      expect(is).toBeDefined();
      expect(is!.tgisVerbaNumero).toBe('2.2');
      expect(is!.valorLiquidar).toBe((BigInt(10_000_000_00) * 4n) / 1000n);
    });

    it('arrendamento habitacional dispara Verba 2.1 (0,1%)', () => {
      const actos = engine.evaluate(
        ctxBase({
          categoria: TipoContratoCategoria.IMOBILIARIO,
          tipoCodigo: 'ARRENDAMENTO_HABITACIONAL',
        }),
      );
      const is = actos.find((a) => a.regraId === 'IS_ARRENDAMENTO_HABITACIONAL');
      expect(is).toBeDefined();
      expect(is!.tgisVerbaNumero).toBe('2.1');
      expect(is!.valorLiquidar).toBe((BigInt(10_000_000_00) * 1n) / 1000n);
    });

    it('contrato de trabalho é ISENTO (art. 6.º n.º 3 alínea t)', () => {
      const actos = engine.evaluate(
        ctxBase({ categoria: TipoContratoCategoria.TRABALHO, tipoCodigo: 'TRABALHO' }),
      );
      const is = actos.find((a) => a.regraId === 'IS_TRABALHO_ISENTO');
      expect(is).toBeDefined();
      expect(is!.tgisVerbaNumero).toBe('ISENTO');
      expect(is!.referenciaLegal).toMatch(/Art\. 6\.º/);
    });

    it('mútuo dispara Verba 16.1.1 (0,5% — prazo até 1 ano)', () => {
      const actos = engine.evaluate(
        ctxBase({ tipoCodigo: 'MUTUO', categoria: TipoContratoCategoria.FINANCEIRO }),
      );
      const is = actos.find((a) => a.regraId === 'IS_MUTUO');
      expect(is).toBeDefined();
      expect(is!.tgisVerbaNumero).toBe('16.1.1');
      expect(is!.valorLiquidar).toBe((BigInt(10_000_000_00) * 5n) / 1000n);
    });

    it('compra e venda imóvel dispara Verba 1 (0,3%) + notário + registo predial', () => {
      const actos = engine.evaluate(
        ctxBase({
          tipoCodigo: 'COMPRAVENDA_IMOVEL',
          categoria: TipoContratoCategoria.IMOBILIARIO,
          hasObjectoImovel: true,
        }),
      );
      const ids = actos.map((a) => a.regraId);
      expect(ids).toEqual(
        expect.arrayContaining([
          'IS_COMPRAVENDA_IMOVEL',
          'NOTARIO_COMPRAVENDA_IMOVEL',
          'REGISTO_PREDIAL',
        ]),
      );
      const is = actos.find((a) => a.regraId === 'IS_COMPRAVENDA_IMOVEL')!;
      expect(is.tgisVerbaNumero).toBe('1');
      expect(is.valorLiquidar).toBe((BigInt(10_000_000_00) * 3n) / 1000n);
    });

    it('empreitada dispara IS_EMPREITADA (1%)', () => {
      const actos = engine.evaluate(
        ctxBase({ tipoCodigo: 'EMPREITADA', categoria: TipoContratoCategoria.IMOBILIARIO }),
      );
      expect(actos.find((a) => a.regraId === 'IS_EMPREITADA')).toBeDefined();
    });

    it('garantia/penhor dispara IS_GARANTIA', () => {
      for (const code of ['GARANTIA', 'PENHOR']) {
        const actos = engine.evaluate(
          ctxBase({ tipoCodigo: code, categoria: TipoContratoCategoria.FINANCEIRO }),
        );
        expect(actos.find((a) => a.regraId === 'IS_GARANTIA')).toBeDefined();
      }
    });

    it('licença/cessão IP dispara IS_LICENCA_IP', () => {
      const actos = engine.evaluate(
        ctxBase({
          tipoCodigo: 'LICENCA_SOFTWARE',
          categoria: TipoContratoCategoria.IP,
        }),
      );
      expect(actos.find((a) => a.regraId === 'IS_LICENCA_IP')).toBeDefined();
    });

    it('fornecimento/distribuição dispara IS_FORNECIMENTO', () => {
      for (const code of ['FORNECIMENTO', 'DISTRIBUICAO']) {
        const actos = engine.evaluate(
          ctxBase({ tipoCodigo: code, categoria: TipoContratoCategoria.BENS }),
        );
        expect(actos.find((a) => a.regraId === 'IS_FORNECIMENTO')).toBeDefined();
      }
    });

    it('contrato de serviços sem valor não dispara IS (base tributável ausente)', () => {
      const actos = engine.evaluate(ctxBase({ valor: null }));
      expect(actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS')).toBeUndefined();
    });

    // ── Moeda estrangeira (auditoria Jul/2026) ──────────────
    it('contrato em USD calcula o IS sobre o CONTRAVALOR em AKZ, não sobre o valor em USD', () => {
      const actos = engine.evaluate(
        ctxBase({
          valor: BigInt(100_000_00), // USD 100k
          moeda: 'USD',
          valorEmAKZ: BigInt(90_000_000_00), // AKZ 90M
        }),
      );
      const is = actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS');
      expect(is).toBeDefined();
      expect(is!.baseTributavel).toBe(BigInt(90_000_000_00));
      expect(is!.valorLiquidar).toBe((BigInt(90_000_000_00) * 7n) / 100n);
    });

    it('contrato em USD SEM contravalor não calcula valor (nunca 7% sobre centavos de USD) e avisa', () => {
      const actos = engine.evaluate(
        ctxBase({
          valor: BigInt(100_000_00),
          moeda: 'USD',
          valorEmAKZ: null,
        }),
      );
      const is = actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS');
      expect(is).toBeDefined();
      expect(is!.valorLiquidar).toBeUndefined();
      expect(is!.observacoes).toMatch(/sem contravalor em AKZ/);
    });

    it("'AKZ' e 'AOA' são ambos kwanza — o valor directo é a base", () => {
      for (const moeda of ['AKZ', 'AOA']) {
        const actos = engine.evaluate(
          ctxBase({ moeda, valorEmAKZ: null }),
        );
        const is = actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS');
        expect(is!.baseTributavel).toBe(BigInt(10_000_000_00));
      }
    });

    // ── Prazo a partir do facto tributário (auditoria Jul/2026) ──
    it('prazoLimite conta da dataAssinatura — herdado de 2023 mostra o IS em mora, não "a vencer"', () => {
      const assinado = new Date('2023-03-15');
      const actos = engine.evaluate(
        ctxBase({ dataAssinatura: assinado }),
        assinado, // vigência avaliada à data do facto (comportamento existente)
      );
      const is = actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS');
      expect(is!.prazoLimite).toEqual(new Date('2023-04-14'));
    });

    it('sem dataAssinatura, o prazo cai para hoje+30 (comportamento anterior)', () => {
      const antes = Date.now();
      const actos = engine.evaluate(ctxBase({ dataAssinatura: null }));
      const is = actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS');
      const esperadoMin = antes + 29.5 * 86_400_000;
      expect(is!.prazoLimite!.getTime()).toBeGreaterThan(esperadoMin);
    });
  });

  // ─── BNA — Lei Cambial / RJOC ────────────────────────────
  describe('BNA / Lei Cambial / RJOC', () => {
    it('serviços com não-residente acima de USD 50k → autorização BNA', () => {
      const actos = engine.evaluate(
        ctxBase({
          moeda: 'USD',
          valor: BigInt(60_000_00),  // USD 60k
          partesResidentes: [true, false],
        }),
      );
      const bna = actos.find((a) => a.regraId === 'BNA_SERVICOS_NAO_RESIDENTE');
      expect(bna).toBeDefined();
      expect(bna!.tipo).toBe(ActoRegulatorioTipo.BNA_AUTORIZACAO);
    });

    it('serviços com não-residente entre USD 10k e USD 50k → registo BNA', () => {
      const actos = engine.evaluate(
        ctxBase({
          moeda: 'USD',
          valor: BigInt(20_000_00),  // USD 20k
          partesResidentes: [true, false],
        }),
      );
      expect(actos.find((a) => a.regraId === 'BNA_REGISTO_SERVICOS_PEQUENO')).toBeDefined();
      expect(actos.find((a) => a.regraId === 'BNA_SERVICOS_NAO_RESIDENTE')).toBeUndefined();
    });

    it('serviços só entre residentes não dispara BNA', () => {
      const actos = engine.evaluate(
        ctxBase({ moeda: 'USD', valor: BigInt(1_000_000_00) }),
      );
      const bnaActos = actos.filter((a) => a.regraId.startsWith('BNA_'));
      expect(bnaActos).toHaveLength(0);
    });

    it('mútuo com não-residente dispara BNA_MUTUO_INTERNACIONAL', () => {
      const actos = engine.evaluate(
        ctxBase({
          tipoCodigo: 'MUTUO',
          categoria: TipoContratoCategoria.FINANCEIRO,
          partesResidentes: [true, false],
        }),
      );
      expect(actos.find((a) => a.regraId === 'BNA_MUTUO_INTERNACIONAL')).toBeDefined();
    });
  });

  // ─── AGT — Retenção IRT ──────────────────────────────────
  describe('AGT — Retenção IRT (15% sobre serviços de não-residentes)', () => {
    it('serviços a não-residente → retenção 15%', () => {
      const ctx = ctxBase({ partesResidentes: [true, false] });
      const actos = engine.evaluate(ctx);
      const irt = actos.find((a) => a.regraId === 'AGT_RETENCAO_IRT_NAO_RESIDENTE');
      expect(irt).toBeDefined();
      expect(irt!.valorLiquidar).toBe((ctx.valor! * 15n) / 100n);
      expect(irt!.referenciaLegal).toMatch(/15%.+6,5%/);
    });
    it('IP a não-residente também dispara retenção IRT (royalties)', () => {
      const ctx = ctxBase({
        partesResidentes: [true, false],
        categoria: TipoContratoCategoria.IP,
        tipoCodigo: 'LICENCA_SOFTWARE',
      });
      expect(engine.evaluate(ctx).find((a) => a.regraId === 'AGT_RETENCAO_IRT_NAO_RESIDENTE')).toBeDefined();
    });
    it('serviços só entre residentes → não há retenção', () => {
      const actos = engine.evaluate(ctxBase());
      expect(actos.find((a) => a.regraId === 'AGT_RETENCAO_IRT_NAO_RESIDENTE')).toBeUndefined();
    });
  });

  // ─── Registos ────────────────────────────────────────────
  describe('Registos públicos', () => {
    it('objecto imóvel → registo predial', () => {
      const actos = engine.evaluate(ctxBase({ hasObjectoImovel: true }));
      expect(actos.find((a) => a.regraId === 'REGISTO_PREDIAL')).toBeDefined();
    });
    it('objecto societário → registo comercial', () => {
      const actos = engine.evaluate(ctxBase({ hasObjectoSocietario: true }));
      expect(actos.find((a) => a.regraId === 'REGISTO_COMERCIAL')).toBeDefined();
    });
    it('objecto automóvel → registo automóvel', () => {
      const actos = engine.evaluate(ctxBase({ hasObjectoAutomovel: true }));
      expect(actos.find((a) => a.regraId === 'REGISTO_AUTOMOVEL')).toBeDefined();
    });
    it('objecto IP → registo IAPI', () => {
      const actos = engine.evaluate(ctxBase({ hasObjectoIP: true }));
      expect(actos.find((a) => a.regraId === 'REGISTO_IP_IAPI')).toBeDefined();
    });
    it('sem objecto especial → nenhum registo', () => {
      const actos = engine.evaluate(ctxBase());
      expect(actos.filter((a) => a.regraId.startsWith('REGISTO_'))).toHaveLength(0);
    });
  });

  // ─── Notário ────────────────────────────────────────────
  describe('Reconhecimento notarial', () => {
    it('compra e venda de imóvel → notário obrigatório', () => {
      const actos = engine.evaluate(
        ctxBase({
          tipoCodigo: 'COMPRAVENDA_IMOVEL',
          categoria: TipoContratoCategoria.IMOBILIARIO,
        }),
      );
      expect(actos.find((a) => a.regraId === 'NOTARIO_COMPRAVENDA_IMOVEL')).toBeDefined();
    });
    it('objecto societário → notário (pacto social)', () => {
      const actos = engine.evaluate(ctxBase({ hasObjectoSocietario: true }));
      expect(actos.find((a) => a.regraId === 'NOTARIO_PACTO_SOCIAL')).toBeDefined();
    });
  });

  // ─── Disclaimer + referência legal ──────────────────────
  describe('Compliance hygiene', () => {
    it('TODOS os actos sugeridos têm disclaimer e referência legal', () => {
      const ctxs = [
        ctxBase(),
        ctxBase({ tipoCodigo: 'COMPRAVENDA_IMOVEL', categoria: TipoContratoCategoria.IMOBILIARIO, hasObjectoImovel: true }),
        ctxBase({ tipoCodigo: 'MUTUO', categoria: TipoContratoCategoria.FINANCEIRO, partesResidentes: [true, false] }),
      ];
      for (const ctx of ctxs) {
        const actos = engine.evaluate(ctx);
        for (const a of actos) {
          expect(a.disclaimer).toBeDefined();
          expect(a.disclaimer.length).toBeGreaterThan(40);
          expect(a.referenciaLegal).toBeDefined();
          expect(a.referenciaLegal.length).toBeGreaterThan(10);
          expect(a.regraId).toBeDefined();
          expect(a.regraVersao).toMatch(/^\d{4}\.\d+$/);
        }
      }
    });

    it('o engine é determinístico (mesma entrada → mesma saída)', () => {
      const ctx = ctxBase({ partesResidentes: [true, false] });
      const r1 = engine.evaluate(ctx);
      const r2 = engine.evaluate(ctx);
      expect(r1.map((a) => a.regraId).sort()).toEqual(r2.map((a) => a.regraId).sort());
    });
  });

  // ─── Vigência temporal ──────────────────────────────────
  describe('Vigência temporal', () => {
    it('regras TGIS (vigência 2014-10-21) não disparam antes', () => {
      const actos = engine.evaluate(ctxBase(), new Date('2014-10-20'));
      // BNA/AGT vigentes desde 2020-01-01 mas TGIS desde 2014
      // → IS_PRESTACAO_SERVICOS não vigente em 2014-10-20
      expect(actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS')).toBeUndefined();
    });
    it('regras TGIS já vigentes em 2015 disparam em 2015', () => {
      const actos = engine.evaluate(ctxBase(), new Date('2015-01-01'));
      expect(actos.find((a) => a.regraId === 'IS_PRESTACAO_SERVICOS')).toBeDefined();
    });
  });

  // ─── Introspecção ───────────────────────────────────────
  describe('listAllRules()', () => {
    it('lista todas as regras com metadados', () => {
      const rules = engine.listAllRules();
      expect(rules.length).toBeGreaterThanOrEqual(20);
      for (const r of rules) {
        expect(r.id).toBeDefined();
        expect(r.versao).toBeDefined();
        expect(r.tipo).toBeDefined();
        expect(r.referenciaLegal).toBeDefined();
      }
    });
  });
});
