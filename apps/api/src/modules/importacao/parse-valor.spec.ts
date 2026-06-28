import { parseValorCentavos } from './importacao.service';

// Cobre o parser de valor monetário do CSV de importação — locale PT/EN,
// separadores de milhares (espaço/ponto/vírgula) e decimais.
describe('parseValorCentavos', () => {
  it.each<[string | number | undefined, bigint | undefined]>([
    [undefined, undefined],
    ['', undefined],
    ['   ', undefined],
    // Inteiros com separador de milhares
    ['12 500 000', BigInt(1_250_000_000)], // espaço (formato documentado)
    ['12500000', BigInt(1_250_000_000)],
    ['12.500.000', BigInt(1_250_000_000)], // ponto milhares (PT)
    ['12,500,000', BigInt(1_250_000_000)], // vírgula milhares (EN)
    ['12,500', BigInt(1_250_000)], // vírgula + 3 dígitos = milhares
    // Decimais
    ['1500,50', BigInt(150_050)], // vírgula decimal (PT)
    ['1500.50', BigInt(150_050)], // ponto decimal (EN)
    ['12.500.000,50', BigInt(1_250_000_050)], // PT completo
    ['12,500,000.50', BigInt(1_250_000_050)], // EN completo
    // Numérico directo
    [12500000, BigInt(1_250_000_000)],
    // Negativos rejeitados
    ['-100', undefined],
  ])('%s → %s centavos', (input, esperado) => {
    expect(parseValorCentavos(input)).toBe(esperado);
  });
});
