/**
 * Line-level diff utility — LCS clássico.
 *
 * Para o use case CLM (comparar markdown entre versões de contrato)
 * line-level é suficiente: as cláusulas normalmente alteram-se ao
 * nível da linha/parágrafo, não do carácter. Para character-level
 * (ideal para inline highlight em UI) podemos adicionar Myers diff
 * numa v2 — fica reservado.
 *
 * Custos: O(n·m) memória + tempo na tabela LCS. Para contratos típicos
 * (até ~1000 linhas) é trivial. Acima de ~5000 linhas considerar
 * shingling antes da tabela.
 *
 * Sem dependências externas — implementação pura.
 */

export type DiffOp = 'equal' | 'add' | 'remove';

export interface WordOp {
  op: DiffOp;
  /** Token (palavra, pontuação ou espaço). */
  text: string;
}

export interface DiffLine {
  op: DiffOp;
  /** Texto da linha (mantemos o conteúdo original, sem trimEnd). */
  text: string;
  /** Número da linha no texto antigo (1-based) — apenas para `equal` e `remove`. */
  oldLine?: number;
  /** Número da linha no texto novo (1-based) — apenas para `equal` e `add`. */
  newLine?: number;
  /**
   * Quando esta linha faz parte de um par remove+add adjacente,
   * carregamos o diff word-level. UI usa para destacar inline as
   * palavras específicas que mudaram, em vez de pintar a linha
   * inteira como removida/adicionada.
   *
   * Presente em ambos os lados do par (com ops diferentes — `remove`
   * mostra tokens "remove" + "equal"; `add` mostra "add" + "equal").
   */
  wordOps?: WordOp[];
  /**
   * Id de pareamento: se duas linhas (uma remove, uma add) foram
   * detectadas como modificação da mesma linha lógica, partilham
   * este id. UI pode usar para renderizar como bloco modificado
   * único.
   */
  pairId?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
    /** Hash dos dois lados — útil para o caller cachar UI. */
    hashOld: string;
    hashNew: string;
  };
}

/**
 * Computa o diff line-by-line entre `oldText` e `newText`.
 *
 * Algoritmo:
 *  1. Tokeniza ambos por \n
 *  2. Constrói tabela LCS (longest common subsequence)
 *  3. Backtrace produzindo a sequência de operações
 *
 * O(n·m) em tempo e memória. Para o nosso domínio é suficiente.
 */
export function diffLines(oldText: string, newText: string): DiffResult {
  const oldLines = (oldText ?? '').replace(/\r\n/g, '\n').split('\n');
  const newLines = (newText ?? '').replace(/\r\n/g, '\n').split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  // Tabela LCS — lcs[i][j] = comprimento da LCS de oldLines[0..i] / newLines[0..j]
  // Usamos Uint32Array em flat para mantermos memória mais previsível.
  const lcs = new Uint32Array((m + 1) * (n + 1));
  const w = n + 1;
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        lcs[i * w + j] = lcs[(i + 1) * w + (j + 1)] + 1;
      } else {
        const a = lcs[(i + 1) * w + j];
        const b = lcs[i * w + (j + 1)];
        lcs[i * w + j] = a > b ? a : b;
      }
    }
  }

  // Backtrace
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      lines.push({ op: 'equal', text: oldLines[i], oldLine: i + 1, newLine: j + 1 });
      unchanged++;
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + (j + 1)]) {
      lines.push({ op: 'remove', text: oldLines[i], oldLine: i + 1 });
      removed++;
      i++;
    } else {
      lines.push({ op: 'add', text: newLines[j], newLine: j + 1 });
      added++;
      j++;
    }
  }
  while (i < m) {
    lines.push({ op: 'remove', text: oldLines[i], oldLine: i + 1 });
    removed++;
    i++;
  }
  while (j < n) {
    lines.push({ op: 'add', text: newLines[j], newLine: j + 1 });
    added++;
    j++;
  }

  // Post-processing: detecta pares adjacentes remove→add e calcula
  // word-level diff entre eles. Permite à UI mostrar inline o que
  // mudou dentro da linha, em vez de "linha inteira removida + linha
  // inteira adicionada".
  //
  // Estratégia de pareamento:
  //  - Janela: para cada bloco contíguo de `remove`s seguido de um
  //    bloco de `add`s, pareamos por índice (remove[0]↔add[0], etc).
  //  - Threshold de similaridade: só vinculamos se o LCS de tokens
  //    cobrir ≥30% do max(len(old), len(new)). Abaixo disso são
  //    linhas verdadeiramente distintas e o par seria ruído.
  let pairCounter = 0;
  let k = 0;
  while (k < lines.length) {
    // Encontrar bloco de removes
    let rStart = k;
    while (rStart < lines.length && lines[rStart].op !== 'remove') rStart++;
    if (rStart >= lines.length) break;
    let rEnd = rStart;
    while (rEnd < lines.length && lines[rEnd].op === 'remove') rEnd++;
    // Imediatamente a seguir, bloco de adds
    const aStart = rEnd;
    let aEnd = aStart;
    while (aEnd < lines.length && lines[aEnd].op === 'add') aEnd++;

    const removes = rEnd - rStart;
    const adds = aEnd - aStart;
    if (removes > 0 && adds > 0) {
      const pairCount = Math.min(removes, adds);
      for (let p = 0; p < pairCount; p++) {
        const rLine = lines[rStart + p];
        const aLine = lines[aStart + p];
        const paired = pairWordDiff(rLine.text, aLine.text);
        if (paired) {
          pairCounter++;
          rLine.wordOps = paired.left;
          rLine.pairId = pairCounter;
          aLine.wordOps = paired.right;
          aLine.pairId = pairCounter;
        }
      }
    }
    k = aEnd > rEnd ? aEnd : rEnd;
  }

  return {
    lines,
    stats: {
      added,
      removed,
      unchanged,
      hashOld: cheapHash(oldText),
      hashNew: cheapHash(newText),
    },
  };
}

/**
 * Tokeniza texto em palavras, pontuação e espaços, preservando todos
 * os caracteres. `"foo bar."` → `["foo", " ", "bar", "."]`. Permite
 * reconstrução exacta via `.join('')`.
 */
export function tokeniseWords(s: string): string[] {
  // Match: corrida de letras/dígitos OU espaços OU qualquer outro
  // carácter individual (pontuação).
  const tokens: string[] = [];
  const re = /([\p{L}\p{N}]+)|(\s+)|([^\s\p{L}\p{N}])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

/**
 * Word-level LCS entre duas linhas. Devolve duas sequências de WordOp
 * (uma vista da linha antiga, uma da nova) que reconstituem o texto
 * por `.text` concatenado. Usado para inline highlight.
 *
 * Retorna `null` se as duas linhas mal partilham tokens (similaridade
 * <30%) — nesse caso preferimos manter a apresentação line-level.
 */
export function pairWordDiff(
  oldText: string,
  newText: string,
): { left: WordOp[]; right: WordOp[] } | null {
  if (oldText === newText) return null;
  const a = tokeniseWords(oldText);
  const b = tokeniseWords(newText);
  if (a.length === 0 && b.length === 0) return null;

  const m = a.length;
  const n = b.length;
  // LCS table — espaço O(m·n) em Uint32Array. Para linhas típicas de
  // contrato (raramente >200 tokens) é negligível.
  const lcs = new Uint32Array((m + 1) * (n + 1));
  const w = n + 1;
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        lcs[i * w + j] = lcs[(i + 1) * w + (j + 1)] + 1;
      } else {
        const x = lcs[(i + 1) * w + j];
        const y = lcs[i * w + (j + 1)];
        lcs[i * w + j] = x > y ? x : y;
      }
    }
  }

  // Threshold de similaridade: tokens não-whitespace partilhados
  // sobre o max dos lados. Whitespace não conta para o ratio (senão
  // duas linhas de pontuação diferente partilhariam espaços e
  // pareceriam similares).
  const sharedNonWs = countSharedNonWhitespace(a, b, lcs, w);
  const denom = Math.max(
    a.filter((t) => !/^\s+$/.test(t)).length,
    b.filter((t) => !/^\s+$/.test(t)).length,
    1,
  );
  if (sharedNonWs / denom < 0.3) return null;

  const left: WordOp[] = [];
  const right: WordOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      left.push({ op: 'equal', text: a[i] });
      right.push({ op: 'equal', text: b[j] });
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + (j + 1)]) {
      left.push({ op: 'remove', text: a[i] });
      i++;
    } else {
      right.push({ op: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) {
    left.push({ op: 'remove', text: a[i] });
    i++;
  }
  while (j < n) {
    right.push({ op: 'add', text: b[j] });
    j++;
  }

  return { left, right };
}

function countSharedNonWhitespace(
  a: string[],
  b: string[],
  lcs: Uint32Array,
  w: number,
): number {
  let shared = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      if (!/^\s+$/.test(a[i])) shared++;
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + (j + 1)]) {
      i++;
    } else {
      j++;
    }
  }
  return shared;
}

/**
 * Hash leve não-criptográfico — só para cache key no front-end.
 * (Se precisarmos prova de integridade, usamos crypto.createHash.)
 */
function cheapHash(s: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
