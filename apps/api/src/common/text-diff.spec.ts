import { diffLines, pairWordDiff, tokeniseWords } from './text-diff';

describe('text-diff: line-level', () => {
  it('returns all equal when texts are identical', () => {
    const r = diffLines('a\nb\nc', 'a\nb\nc');
    expect(r.stats.added).toBe(0);
    expect(r.stats.removed).toBe(0);
    expect(r.stats.unchanged).toBe(3);
    expect(r.lines.every((l) => l.op === 'equal')).toBe(true);
  });

  it('detects pure addition', () => {
    const r = diffLines('a\nb', 'a\nb\nc');
    expect(r.stats.added).toBe(1);
    expect(r.stats.removed).toBe(0);
    expect(r.lines.find((l) => l.op === 'add')?.text).toBe('c');
  });

  it('detects pure removal', () => {
    const r = diffLines('a\nb\nc', 'a\nc');
    expect(r.stats.removed).toBe(1);
    expect(r.lines.find((l) => l.op === 'remove')?.text).toBe('b');
  });

  it('pairs adjacent remove+add as modification with wordOps', () => {
    const r = diffLines(
      'O valor é de 100.000 Kz.',
      'O valor é de 150.000 Kz.',
    );
    const removed = r.lines.find((l) => l.op === 'remove');
    const added = r.lines.find((l) => l.op === 'add');
    expect(removed?.wordOps).toBeDefined();
    expect(added?.wordOps).toBeDefined();
    expect(removed?.pairId).toBe(added?.pairId);
    // O lado removido tem op:'remove' para "100" e equal para "Kz"
    const removedTokens = removed!.wordOps!.filter((o) => o.op === 'remove');
    expect(removedTokens.some((t) => t.text === '100')).toBe(true);
  });

  it('does NOT pair when lines are too dissimilar', () => {
    const r = diffLines(
      'Cláusula primeira: objecto do contrato.',
      'Sem mais nada.',
    );
    const removed = r.lines.find((l) => l.op === 'remove');
    const added = r.lines.find((l) => l.op === 'add');
    expect(removed?.wordOps).toBeUndefined();
    expect(added?.wordOps).toBeUndefined();
  });

  it('handles CRLF normalisation', () => {
    const r = diffLines('a\r\nb', 'a\nb');
    expect(r.stats.unchanged).toBe(2);
    expect(r.stats.added).toBe(0);
    expect(r.stats.removed).toBe(0);
  });
});

describe('text-diff: tokeniseWords', () => {
  it('preserves all characters', () => {
    const s = '  foo bar.  baz!';
    const tokens = tokeniseWords(s);
    expect(tokens.join('')).toBe(s);
  });

  it('separates words from punctuation', () => {
    const tokens = tokeniseWords('foo, bar.');
    expect(tokens).toEqual(['foo', ',', ' ', 'bar', '.']);
  });

  it('handles unicode (acentos PT)', () => {
    const tokens = tokeniseWords('cláusula condição');
    expect(tokens).toEqual(['cláusula', ' ', 'condição']);
  });
});

describe('text-diff: pairWordDiff', () => {
  it('returns null on identical', () => {
    expect(pairWordDiff('abc', 'abc')).toBeNull();
  });

  it('produces matching pairId-friendly word ops', () => {
    const r = pairWordDiff('valor de 100 Kz', 'valor de 200 Kz');
    expect(r).not.toBeNull();
    expect(r!.left.find((t) => t.op === 'remove')?.text).toBe('100');
    expect(r!.right.find((t) => t.op === 'add')?.text).toBe('200');
    // Reconstrução pelo lado equal+remove tem de igualar o texto antigo
    const leftReconstructed = r!.left
      .filter((t) => t.op !== 'add')
      .map((t) => t.text)
      .join('');
    expect(leftReconstructed).toBe('valor de 100 Kz');
  });

  it('returns null below similarity threshold', () => {
    // Quase nada em comum
    const r = pairWordDiff('completamente diferente', 'outra coisa qualquer');
    expect(r).toBeNull();
  });
});
