import { CreateEntidadeSchema } from './entidades.dto';
import {
  EntidadeNacionalidadeCambial,
  EntidadeTipo,
} from '@kamaia/shared-types';

describe('CreateEntidadeSchema — NIF validation (E.3)', () => {
  const base = {
    tipo: EntidadeTipo.PESSOA_COLECTIVA,
    nome: 'Acme Lda',
  };

  it('aceita NIF angolano com 10 dígitos', () => {
    const r = CreateEntidadeSchema.safeParse({ ...base, nif: '5000123456' });
    expect(r.success).toBe(true);
  });

  it('rejeita NIF angolano com 9 dígitos', () => {
    const r = CreateEntidadeSchema.safeParse({ ...base, nif: '500012345' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['nif']);
    }
  });

  it('rejeita NIF angolano com letras', () => {
    const r = CreateEntidadeSchema.safeParse({ ...base, nif: '50001234AB' });
    expect(r.success).toBe(false);
  });

  it('aceita NIF com pontos/hífens (sanitização)', () => {
    const r = CreateEntidadeSchema.safeParse({
      ...base,
      nif: '5000.123.456',
    });
    expect(r.success).toBe(true);
  });

  it('NAO_RESIDENTE aceita NIF alfanumérico estrangeiro', () => {
    const r = CreateEntidadeSchema.safeParse({
      ...base,
      nif: 'PT508123456',
      nacionalidadeCambial: EntidadeNacionalidadeCambial.NAO_RESIDENTE,
      paisResidencia: 'PT',
    });
    expect(r.success).toBe(true);
  });

  it('NAO_RESIDENTE rejeita NIF com menos de 6 chars', () => {
    const r = CreateEntidadeSchema.safeParse({
      ...base,
      nif: 'X123',
      nacionalidadeCambial: EntidadeNacionalidadeCambial.NAO_RESIDENTE,
    });
    expect(r.success).toBe(false);
  });

  it('NIF vazio é OK (campo opcional)', () => {
    const r = CreateEntidadeSchema.safeParse(base);
    expect(r.success).toBe(true);
  });
});

describe('CreateEntidadeSchema — flag isInstituicaoFinanceira (E.5)', () => {
  it('aceita true', () => {
    const r = CreateEntidadeSchema.safeParse({
      tipo: EntidadeTipo.PESSOA_COLECTIVA,
      nome: 'BAI',
      isInstituicaoFinanceira: true,
    });
    expect(r.success).toBe(true);
  });

  it('default a undefined (não required)', () => {
    const r = CreateEntidadeSchema.safeParse({
      tipo: EntidadeTipo.PESSOA_COLECTIVA,
      nome: 'Acme',
    });
    expect(r.success).toBe(true);
  });
});
