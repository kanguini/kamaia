/**
 * Renderer de placeholders mustache-like — apenas para o catálogo de
 * templates de contrato. NÃO é um motor mustache completo (sem
 * blocos, sem partials, sem helpers user-defined).
 *
 * Sintaxe suportada:
 *
 *   {{key.path}}                  — caminho simples
 *   {{partes.contraparte.nome}}   — caminho aninhado
 *   {{partes.0.nome}}             — índice de array
 *   {{valor | money}}             — pipe filter
 *   {{lei | default:"direito angolano"}}
 *                                 — pipe com arg literal
 *
 * Quando o caminho não resolve, em vez de string vazia (que daria
 * "contrato sem foro"), emite o marcador `[A COMPLETAR — <path>]` —
 * mesma convenção do stub da IA. Permite ao utilizador ver de relance
 * o que falta preencher depois.
 *
 * Segurança: NÃO faz escape de HTML — é input para markdown, não para
 * HTML directo. O renderer markdown (apps/api/src/common/markdown.ts)
 * faz o escape no final.
 */

export interface PlaceholderContext {
  // Permite path arbitrário; o resolver desce com `key.path`.
  // Aceitamos `unknown` para forçar o caller a tipar bem o builder.
  [key: string]: unknown;
}

const PLACEHOLDER_RE = /\{\{\s*([^}|\s]+)\s*(?:\|\s*([^}]+))?\s*\}\}/g;

/**
 * Filters built-in. Cada filtro recebe (value, arg?) e devolve string.
 * Mantemos a lista curta — qualquer formatação mais sofisticada deve
 * acontecer no caller que constrói o contexto.
 */
const FILTERS: Record<string, (v: unknown, arg?: string) => string> = {
  /** Formata BigInt centavos → "1.234.567,89 AOA". Aceita string|number|bigint. */
  money(v, currency = 'AOA') {
    if (v === null || v === undefined || v === '') return '';
    let num: number;
    if (typeof v === 'bigint') num = Number(v) / 100;
    else if (typeof v === 'string') num = Number(v) / 100;
    else if (typeof v === 'number') num = v;
    else return String(v);
    if (!Number.isFinite(num)) return String(v);
    try {
      return new Intl.NumberFormat('pt-AO', {
        style: 'currency',
        currency: currency.replace(/^["']|["']$/g, ''),
      }).format(num);
    } catch {
      return `${num.toFixed(2)} ${currency}`;
    }
  },

  /** Date → DD/MM/AAAA pt-PT. */
  date(v) {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  },

  /** Date long → "23 de Junho de 2026". */
  dateLong(v) {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('pt-PT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  },

  upper(v) {
    return String(v ?? '').toUpperCase();
  },

  lower(v) {
    return String(v ?? '').toLowerCase();
  },

  /** Valor por defeito quando o path resolve a empty/null. */
  default(v, fallback = '') {
    if (v === undefined || v === null || v === '') {
      return fallback.replace(/^["']|["']$/g, '');
    }
    return String(v);
  },
};

/**
 * Renderiza o template substituindo `{{...}}` com valores do contexto.
 * Caminhos não resolvidos viram `[A COMPLETAR — path]`.
 */
export function renderPlaceholders(
  template: string,
  ctx: PlaceholderContext,
): string {
  return template.replace(PLACEHOLDER_RE, (_match, pathPart: string, filterPart?: string) => {
    const path = pathPart.trim();
    const raw = resolvePath(ctx, path);

    // Aplica filter chain (suportamos só um filtro por uniformidade;
    // chains complexos não justificam a complexidade aqui).
    let value: string;
    if (filterPart) {
      const { name, arg } = parseFilter(filterPart.trim());
      const fn = FILTERS[name];
      if (fn) {
        value = fn(raw, arg);
      } else {
        // Filter desconhecido → ignora, devolve raw
        value = stringify(raw);
      }
    } else {
      value = stringify(raw);
    }

    // Se ficou vazio depois da resolução + filter, marcador de TODO
    // (excepto se o filter foi `default` — esse já tem fallback).
    if (value === '' && !(filterPart && filterPart.trim().startsWith('default'))) {
      return `[A COMPLETAR — ${path}]`;
    }
    return value;
  });
}

function parseFilter(s: string): { name: string; arg?: string } {
  const colon = s.indexOf(':');
  if (colon === -1) return { name: s.trim() };
  return {
    name: s.slice(0, colon).trim(),
    arg: s.slice(colon + 1).trim(),
  };
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Resolve `a.b.0.c` no objecto/array `ctx`. Devolve `undefined` quando
 * qualquer passo intermédio é null/undefined (NÃO throw — deixa o
 * caller decidir o que fazer com missing).
 */
function resolvePath(ctx: PlaceholderContext, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = ctx;
  for (const part of parts) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) return undefined;
      cursor = cursor[idx];
    } else if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

// ──────────────────────────────────────────────────────────
// Builders especializados para o domínio contratos
// ──────────────────────────────────────────────────────────

/**
 * Constrói o contexto a partir de uma criação de contrato. Tradução
 * directa do DTO + entidades resolvidas + helpers (partes.principal,
 * partes.contraparte, partes.0…). Manter aqui (em vez do template
 * service) para que o JSON do contexto seja testável isoladamente.
 */
export function buildContratoPlaceholderContext(input: {
  titulo: string;
  descricao?: string | null;
  valor?: bigint | string | null;
  moeda?: string | null;
  leiAplicavel?: string | null;
  foro?: string | null;
  dataAssinatura?: Date | null;
  dataInicioVigencia?: Date | null;
  dataTermo?: Date | null;
  renovacaoAutomatica?: boolean;
  janelaDenunciaDias?: number | null;
  tipo: { codigo: string; nome: string; categoria: string };
  partes: Array<{
    papel: string;
    ordem: number;
    representanteNome?: string | null;
    representanteCargo?: string | null;
    representanteBI?: string | null;
    entidade: {
      nome: string;
      nif?: string | null;
      tipo?: string | null;
    };
  }>;
}): PlaceholderContext {
  // Atalhos por papel — primeira parte de cada papel comum
  const findByPapel = (papel: string) =>
    input.partes.find((p) => p.papel === papel);

  const partesByOrdem = [...input.partes].sort((a, b) => a.ordem - b.ordem);

  // Cada parte exposta com path consistente
  const partesArr = partesByOrdem.map((p) => ({
    papel: p.papel,
    nome: p.entidade.nome,
    nif: p.entidade.nif ?? '',
    tipo: p.entidade.tipo ?? '',
    representante: {
      nome: p.representanteNome ?? '',
      cargo: p.representanteCargo ?? '',
      bi: p.representanteBI ?? '',
    },
  }));

  return {
    titulo: input.titulo,
    descricao: input.descricao ?? '',
    valor: input.valor ?? '',
    moeda: input.moeda ?? 'AOA',
    lei: input.leiAplicavel ?? '',
    leiAplicavel: input.leiAplicavel ?? '',
    foro: input.foro ?? '',
    dataAssinatura: input.dataAssinatura ?? '',
    dataInicioVigencia: input.dataInicioVigencia ?? '',
    dataTermo: input.dataTermo ?? '',
    renovacaoAutomatica: input.renovacaoAutomatica ? 'sim' : 'não',
    janelaDenuncia: input.janelaDenunciaDias ?? '',
    tipo: {
      codigo: input.tipo.codigo,
      nome: input.tipo.nome,
      categoria: input.tipo.categoria,
    },
    partes: {
      // Acesso por papel: {{partes.contraparte.nome}}
      principal: findByPapel('PARTE_PRINCIPAL')
        ? toPartePlaceholder(findByPapel('PARTE_PRINCIPAL')!)
        : null,
      contraparte: findByPapel('CONTRAPARTE')
        ? toPartePlaceholder(findByPapel('CONTRAPARTE')!)
        : null,
      garante: findByPapel('GARANTE')
        ? toPartePlaceholder(findByPapel('GARANTE')!)
        : null,
      // Acesso por índice: {{partes.0.nome}}
      ...Object.fromEntries(partesArr.map((p, i) => [String(i), p])),
      // Length para iteração simples se precisar
      length: partesArr.length,
    },
    // Data corrente (útil para "aos X dias do mês de Y")
    hoje: new Date(),
  };
}

function toPartePlaceholder(p: {
  papel: string;
  representanteNome?: string | null;
  representanteCargo?: string | null;
  representanteBI?: string | null;
  entidade: { nome: string; nif?: string | null; tipo?: string | null };
}) {
  return {
    papel: p.papel,
    nome: p.entidade.nome,
    nif: p.entidade.nif ?? '',
    tipo: p.entidade.tipo ?? '',
    representante: {
      nome: p.representanteNome ?? '',
      cargo: p.representanteCargo ?? '',
      bi: p.representanteBI ?? '',
    },
  };
}
