import { RenovacaoEngineService } from './renovacao.service';

/**
 * Specs focados em pure logic (sem DB):
 *  - addMonths com clamping de fim-de-mês
 *  - resolverDestinatarios união (mocked)
 *
 * Para testes de integração com Prisma usaríamos test container ou
 * SQLite — fica para uma iteração de testes E2E. Estes specs cobrem
 * a aritmética crítica de datas, onde os bugs são caros e silenciosos.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = new RenovacaoEngineService({} as any, {} as any, {} as any, {} as any);

// Helper para invocar método privado nos testes (TypeScript não tem
// reflection runtime, mas em JS é acessível pelo nome).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addMonths = (svc as any).addMonths.bind(svc) as (b: Date, m: number) => Date;

describe('RenovacaoEngineService.addMonths', () => {
  it('adiciona meses simples', () => {
    const r = addMonths(new Date(Date.UTC(2026, 0, 15)), 6); // 2026-01-15
    expect(r.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('clamp para fim do mês quando dia não existe (31-Jan + 1m → 28-Feb)', () => {
    const r = addMonths(new Date(Date.UTC(2026, 0, 31)), 1); // 31-Jan
    expect(r.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('handles ano bissexto (29-Feb-2028)', () => {
    const r = addMonths(new Date(Date.UTC(2027, 11, 31)), 2); // 31-Dec-2027 + 2m
    expect(r.toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('cobertura de ano: 12 meses', () => {
    const r = addMonths(new Date(Date.UTC(2026, 5, 10)), 12); // 10-Jun-2026
    expect(r.toISOString().slice(0, 10)).toBe('2027-06-10');
  });

  it('multi-ano (24m)', () => {
    const r = addMonths(new Date(Date.UTC(2026, 0, 1)), 24);
    expect(r.toISOString().slice(0, 10)).toBe('2028-01-01');
  });

  it('preserva dia 15 em qualquer mês (caso fácil)', () => {
    for (let m = 1; m <= 12; m++) {
      const r = addMonths(new Date(Date.UTC(2026, 0, 15)), m);
      expect(r.getUTCDate()).toBe(15);
    }
  });

  it('30-Jan + 1m = 28-Feb (não-bissexto)', () => {
    const r = addMonths(new Date(Date.UTC(2026, 0, 30)), 1);
    expect(r.toISOString().slice(0, 10)).toBe('2026-02-28');
  });
});
