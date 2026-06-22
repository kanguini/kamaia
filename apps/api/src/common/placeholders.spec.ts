import {
  buildContratoPlaceholderContext,
  renderPlaceholders,
} from './placeholders';

describe('renderPlaceholders', () => {
  it('substitui caminhos simples', () => {
    expect(renderPlaceholders('Olá {{nome}}', { nome: 'Maiato' })).toBe(
      'Olá Maiato',
    );
  });

  it('resolve caminhos aninhados', () => {
    const out = renderPlaceholders('{{a.b.c}}', { a: { b: { c: 'ok' } } });
    expect(out).toBe('ok');
  });

  it('resolve índices de array', () => {
    const out = renderPlaceholders('{{lista.1}}', { lista: ['x', 'y', 'z'] });
    expect(out).toBe('y');
  });

  it('marca paths não resolvidos com [A COMPLETAR — path]', () => {
    expect(renderPlaceholders('{{foro}}', {})).toBe('[A COMPLETAR — foro]');
  });

  it('default filter usa o fallback quando vazio', () => {
    expect(
      renderPlaceholders('{{lei | default:"direito angolano"}}', {}),
    ).toBe('direito angolano');
  });

  it('default filter não marca como TODO mesmo se vazio', () => {
    // O caso `default` é especial — significa "sei que pode faltar".
    const out = renderPlaceholders('{{foro | default:"Luanda"}}', { foro: '' });
    expect(out).toBe('Luanda');
  });

  it('money filter formata BigInt centavos', () => {
    const out = renderPlaceholders('{{valor | money}}', {
      valor: BigInt(15000050),
    });
    // Locale pt-AO usa espaço como milhar e vírgula decimal: "150 000,50 Kz"
    expect(out).toMatch(/150[\s.,]000[.,]50/);
    expect(out.toLowerCase()).toMatch(/kz|aoa/);
  });

  it('date filter formata Date para DD/MM/AAAA', () => {
    const out = renderPlaceholders('{{d | date}}', {
      d: new Date('2026-06-23T10:00:00Z'),
    });
    expect(out).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('upper filter caps tudo', () => {
    expect(renderPlaceholders('{{x | upper}}', { x: 'kamaia' })).toBe('KAMAIA');
  });

  it('filter desconhecido é ignorado, devolve raw', () => {
    expect(renderPlaceholders('{{x | reverseAlchemy}}', { x: 'hi' })).toBe(
      'hi',
    );
  });

  it('lida com múltiplos placeholders na mesma linha', () => {
    const out = renderPlaceholders('A {{a}} e B {{b}}', { a: '1', b: '2' });
    expect(out).toBe('A 1 e B 2');
  });
});

describe('buildContratoPlaceholderContext', () => {
  const baseInput = {
    titulo: 'Prestação de serviços',
    descricao: 'Auditoria interna 2026',
    valor: BigInt(15000000),
    moeda: 'AOA',
    leiAplicavel: 'Direito angolano',
    foro: 'Tribunal de Luanda',
    dataInicioVigencia: new Date('2026-07-01'),
    tipo: {
      codigo: 'PRESTACAO_SERVICOS',
      nome: 'Prestação de serviços',
      categoria: 'SERVICOS',
    },
    partes: [
      {
        papel: 'PARTE_PRINCIPAL',
        ordem: 0,
        entidade: { nome: 'Acme Lda', nif: '5000111222', tipo: 'PESSOA_COLECTIVA' },
      },
      {
        papel: 'CONTRAPARTE',
        ordem: 1,
        representanteNome: 'João Silva',
        representanteCargo: 'CEO',
        entidade: { nome: 'Contraparte SA', nif: '5000999888', tipo: 'PESSOA_COLECTIVA' },
      },
    ],
  };

  it('expõe atalhos por papel: principal / contraparte', () => {
    const ctx = buildContratoPlaceholderContext(baseInput);
    expect(renderPlaceholders('{{partes.principal.nome}}', ctx)).toBe('Acme Lda');
    expect(renderPlaceholders('{{partes.contraparte.nome}}', ctx)).toBe(
      'Contraparte SA',
    );
    expect(renderPlaceholders('{{partes.contraparte.representante.nome}}', ctx))
      .toBe('João Silva');
  });

  it('expõe partes por índice', () => {
    const ctx = buildContratoPlaceholderContext(baseInput);
    expect(renderPlaceholders('{{partes.0.nome}}', ctx)).toBe('Acme Lda');
    expect(renderPlaceholders('{{partes.1.nome}}', ctx)).toBe('Contraparte SA');
  });

  it('formata valor via money filter', () => {
    const ctx = buildContratoPlaceholderContext(baseInput);
    const out = renderPlaceholders('{{valor | money}}', ctx);
    expect(out).toMatch(/150[\s.,]000/);
  });

  it('papel inexistente marca TODO', () => {
    const ctx = buildContratoPlaceholderContext(baseInput);
    expect(renderPlaceholders('{{partes.garante.nome}}', ctx)).toBe(
      '[A COMPLETAR — partes.garante.nome]',
    );
  });

  it('NIF vazio resolve para empty string, não para "null"', () => {
    const ctx = buildContratoPlaceholderContext({
      ...baseInput,
      partes: [
        {
          papel: 'PARTE_PRINCIPAL',
          ordem: 0,
          entidade: { nome: 'X', nif: null, tipo: null },
        },
      ],
    });
    expect(renderPlaceholders('{{partes.0.nif}}', ctx)).not.toContain('null');
  });
});
