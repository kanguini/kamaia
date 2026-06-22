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

export interface DiffLine {
  op: DiffOp;
  /** Texto da linha (mantemos o conteúdo original, sem trimEnd). */
  text: string;
  /** Número da linha no texto antigo (1-based) — apenas para `equal` e `remove`. */
  oldLine?: number;
  /** Número da linha no texto novo (1-based) — apenas para `equal` e `add`. */
  newLine?: number;
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
