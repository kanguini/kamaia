import { validatePlaceholders } from './templates.service';

describe('Template placeholders validation', () => {
  it('aceita placeholders válidos', () => {
    const r = validatePlaceholders('Olá {{nome}}, valor {{valor | money}}');
    expect(r).toEqual([]);
  });

  it('detecta chavetas desemparelhadas (abertura sem fecho)', () => {
    const r = validatePlaceholders('Texto com {{x sem fecho');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatch(/sem fecho/);
  });

  it('detecta chavetas desemparelhadas (fecho sem abertura)', () => {
    const r = validatePlaceholders('Texto x}} solto');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatch(/sem abertura/);
  });

  it('AUDIT: detecta `{{` órfão no meio do texto entre placeholders válidos', () => {
    // Caso que o validator antigo (só comparar contagem) deixava passar:
    // `{{a}} {{ {{b}}` tem 3 aberturas e 2 fechos → desemparelhadas só
    // por contagem, mas se o teste antigo só comparasse total seria
    // diferente. Confirmamos que o novo detecta órfão depois de stripping.
    const r = validatePlaceholders('{{a}} {{ {{b}}');
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((i) => /sem fecho/.test(i))).toBe(true);
  });

  it('detecta placeholder vazio {{ }}', () => {
    const r = validatePlaceholders('Texto com {{}} aqui');
    expect(r[0]).toMatch(/vazio/);
  });

  it('múltiplos placeholders aninhados não falham (mesmo emparelhamento)', () => {
    const r = validatePlaceholders('{{a}} {{b}} {{c.d}} {{e | f}}');
    expect(r).toEqual([]);
  });

  it('aceita string vazia', () => {
    expect(validatePlaceholders('')).toEqual([]);
  });
});
