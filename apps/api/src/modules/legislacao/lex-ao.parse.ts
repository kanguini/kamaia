/**
 * Parsing puro do corpus lex.ao (sem I/O — testável e reutilizável).
 *
 * O lex.ao é um Docusaurus com sitemap.xml que enumera ~1.200 diplomas no
 * padrão /docs/<órgão>/<ano>/<slug>/. Estas funções extraem, do HTML de
 * cada página, o título/referência do diploma, órgão, ano, data e corpo.
 */

export const LEX_BASE = 'https://lex.ao';
export const LEX_SITEMAP = `${LEX_BASE}/sitemap.xml`;
export const LEX_UA =
  'KamaiaLegislationImporter/1.0 (+https://kamaia.cc; hello@kamaia.cc)';

// /docs/<orgao>/<ano>/<slug>/  →  [_, orgaoSlug, ano, slug]
export const DOC_RE =
  /^https?:\/\/[^/]+\/docs\/([^/]+)\/(\d{4})\/([^/]+)\/?$/;

export interface ParsedDoc {
  url: string;
  titulo: string;
  diploma: string;
  orgao: string;
  ano: number;
  publicacao: Date | null;
  conteudo: string;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ordf;/g, 'ª')
    .replace(/&ordm;|&deg;/g, 'º')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    );
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]).trim() : null;
}

export function extractArticle(html: string): string {
  // O conteúdo do diploma vive dentro de <article>; removemos
  // navegação/cabeçalho/rodapé para não poluir o corpo.
  const art = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let inner = art ? art[1] : html;
  inner = inner
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  return stripTags(inner);
}

const TIPO =
  '(Lei(?:\\s+Constitucional)?|Decreto(?:[ -](?:Lei|Presidencial|Legislativo|Executivo))?|Aviso|Despacho(?:\\s+Conjunto)?|Resolu[çc][ãa]o|Portaria|Instrutivo|Circular|Ac[óo]rd[ãa]o|Regulamento|Diretiva|Directiva|Ordem\\s+de\\s+Servi[çc]o|C[óo]digo)';

export function parseDiploma(titulo: string): string {
  const re = new RegExp(`${TIPO}\\s+n\\.?\\s*[ºo°]?\\s*[\\d./-]+`, 'i');
  const m = titulo.match(re);
  return (m ? m[0] : titulo).slice(0, 200);
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5,
  junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10,
  novembro: 11, dezembro: 12,
};

export function parsePublicacao(titulo: string, ano: number | null): Date | null {
  const m = titulo.match(/de\s+(\d{1,2})\s+de\s+([a-zç]+)/i);
  if (!m || !ano) return null;
  const dia = parseInt(m[1], 10);
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return isNaN(d.getTime()) ? null : d;
}

export function humanizeOrgao(slug: string): string {
  return slug
    .split('-')
    .map((w) =>
      w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1),
    )
    .join(' ');
}

/** Extrai as <loc> do sitemap e filtra só as páginas de diploma. */
export function extractDocUrls(xml: string, orgaoFilter?: string): string[] {
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) =>
    m[1].trim(),
  );
  return locs.filter((u) => {
    const m = u.match(DOC_RE);
    if (!m) return false;
    if (orgaoFilter && !m[1].includes(orgaoFilter)) return false;
    return true;
  });
}

/** Parseia o HTML de uma página de diploma. Devolve null se não houver título. */
export function parseDocFromHtml(url: string, html: string): ParsedDoc | null {
  const m = url.match(DOC_RE);
  if (!m) return null;
  const [, orgaoSlug, anoStr] = m;
  const ano = parseInt(anoStr, 10);
  const titulo = (extractH1(html) ?? '').trim();
  if (!titulo) return null;
  return {
    url,
    titulo: titulo.slice(0, 300),
    diploma: parseDiploma(titulo),
    orgao: humanizeOrgao(orgaoSlug),
    ano,
    publicacao: parsePublicacao(titulo, ano),
    conteudo: extractArticle(html).slice(0, 200_000),
  };
}

/** Parte o corpo do diploma em trechos para chunking/RAG. */
export function chunkConteudo(conteudo: string, maxLen = 1400): string[] {
  const paras = conteudo
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > maxLen && buf) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  // Trechos demasiado longos (um parágrafo gigante) são cortados.
  return chunks.flatMap((c) =>
    c.length <= maxLen * 1.5
      ? [c]
      : (c.match(new RegExp(`[\\s\\S]{1,${maxLen}}`, 'g')) ?? [c]),
  );
}
