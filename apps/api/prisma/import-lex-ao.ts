/**
 * Importador de legislação a partir do lex.ao  →  LegislationDocument.
 *
 * O lex.ao é um site Docusaurus com um sitemap.xml que enumera ~1.200
 * diplomas no padrão  /docs/<órgão>/<ano>/<slug>/ . Este script:
 *   1. lê o sitemap e filtra as páginas de diploma;
 *   2. visita cada uma (com throttle e retry), extrai título, referência
 *      do diploma, órgão, ano e corpo;
 *   3. faz upsert em legislation_documents pela chave natural `url`.
 *
 * NÃO corre neste ambiente de desenvolvimento do agente (sem rede). Corre
 * onde houver rede + DATABASE_URL a apontar para a BD alvo:
 *
 *   cd apps/api
 *   npx prisma migrate deploy            # aplica os campos novos
 *   npx prisma generate
 *   npx ts-node prisma/import-lex-ao.ts --limit 5 --dry-run   # smoke test
 *   npx ts-node prisma/import-lex-ao.ts --limit 20            # valida 20 reais
 *   npx ts-node prisma/import-lex-ao.ts                       # corpus completo
 *
 * Flags:
 *   --limit N         processa no máximo N diplomas (default: todos)
 *   --concurrency N   pedidos em paralelo (default: 4 — sê gentil com o lex.ao)
 *   --delay MS        pausa entre lotes (default: 250)
 *   --skip-existing   salta URLs já em BD (retoma uma corrida interrompida)
 *   --dry-run         não escreve na BD; só parseia e conta
 *   --orgao SLUG      só diplomas cujo slug de órgão contém SLUG
 *
 * Nota de etiqueta/ToS: o lex.ao é uma fonte de terceiros. Mantém a
 * concorrência baixa, guarda a `url` de origem em cada registo, e confirma
 * que o uso pretendido respeita os Termos do lex.ao antes do crawl completo.
 *
 * Embeddings/RAG (LegislationChunk) ficam para uma fase seguinte — este
 * script só popula os documentos. Sem chunks, o Dr. Kamaia ainda não cita
 * estes diplomas; serve a vista navegável "Legislação".
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE = 'https://lex.ao';
const SITEMAP = `${BASE}/sitemap.xml`;
const UA =
  'KamaiaLegislationImporter/1.0 (+https://kamaia.cc; contacto hello@kamaia.cc)';

// ─── args ────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const LIMIT = arg('limit') ? parseInt(arg('limit')!, 10) : Infinity;
const CONCURRENCY = arg('concurrency') ? parseInt(arg('concurrency')!, 10) : 4;
const DELAY = arg('delay') ? parseInt(arg('delay')!, 10) : 250;
const SKIP_EXISTING = flag('skip-existing');
const DRY_RUN = flag('dry-run');
const ORGAO_FILTER = arg('orgao');

// ─── http ────────────────────────────────────────────────────
async function fetchText(url: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * (attempt + 1)); // backoff linear
    }
  }
  throw new Error('unreachable');
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── parsing helpers ─────────────────────────────────────────
function decodeEntities(s: string): string {
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
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function stripTags(html: string): string {
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
function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]).trim() : null;
}
function extractArticle(html: string): string {
  // Docusaurus: o conteúdo do diploma vive dentro de <article> (ou da div
  // .theme-doc-markdown). Tiramos a navegação/breadcrumbs/paginação.
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
function parseDiploma(titulo: string): string {
  const re = new RegExp(`${TIPO}\\s+n\\.?\\s*[ºo°]?\\s*[\\d./-]+`, 'i');
  const m = titulo.match(re);
  return (m ? m[0] : titulo).slice(0, 200);
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5,
  junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10,
  novembro: 11, dezembro: 12,
};
function parsePublicacao(titulo: string, ano: number | null): Date | null {
  const m = titulo.match(/de\s+(\d{1,2})\s+de\s+([a-zç]+)/i);
  if (!m || !ano) return null;
  const dia = parseInt(m[1], 10);
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return isNaN(d.getTime()) ? null : d;
}
function humanizeOrgao(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// /docs/<orgao>/<ano>/<slug>/  →  { orgaoSlug, ano }
const DOC_RE = /^https?:\/\/[^/]+\/docs\/([^/]+)\/(\d{4})\/([^/]+)\/?$/;

interface Parsed {
  url: string;
  titulo: string;
  diploma: string;
  orgao: string;
  ano: number;
  publicacao: Date | null;
  conteudo: string;
}

async function parseDoc(url: string): Promise<Parsed | null> {
  const m = url.match(DOC_RE);
  if (!m) return null;
  const [, orgaoSlug, anoStr] = m;
  const ano = parseInt(anoStr, 10);
  const html = await fetchText(url);
  const titulo = (extractH1(html) ?? '').trim();
  if (!titulo) return null;
  const conteudo = extractArticle(html);
  return {
    url,
    titulo: titulo.slice(0, 300),
    diploma: parseDiploma(titulo),
    orgao: humanizeOrgao(orgaoSlug),
    ano,
    publicacao: parsePublicacao(titulo, ano),
    conteudo: conteudo.slice(0, 200_000),
  };
}

async function getDocUrls(): Promise<string[]> {
  const xml = await fetchText(SITEMAP);
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) =>
    m[1].trim(),
  );
  return locs.filter((u) => {
    const m = u.match(DOC_RE);
    if (!m) return false;
    if (ORGAO_FILTER && !m[1].includes(ORGAO_FILTER)) return false;
    return true;
  });
}

// ─── pool de workers ─────────────────────────────────────────
async function runPool<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    const i = cursor++;
    if (i >= items.length) return;
    await worker(items[i], i);
    if (i % CONCURRENCY === 0) await sleep(DELAY);
    return runNext();
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => runNext()),
  );
}

async function main() {
  console.log('▶ A ler o sitemap do lex.ao…');
  let urls = await getDocUrls();
  console.log(`  ${urls.length} diplomas encontrados no sitemap.`);

  if (SKIP_EXISTING && !DRY_RUN) {
    const existentes = new Set(
      (
        await prisma.legislationDocument.findMany({
          where: { fonte: 'LEXAO' },
          select: { url: true },
        })
      )
        .map((r) => r.url)
        .filter((u): u is string => !!u),
    );
    const antes = urls.length;
    urls = urls.filter((u) => !existentes.has(u));
    console.log(`  ${antes - urls.length} já em BD, ${urls.length} por importar.`);
  }

  if (urls.length > LIMIT) urls = urls.slice(0, LIMIT);
  console.log(
    `▶ A processar ${urls.length} diplomas (concorrência ${CONCURRENCY}${
      DRY_RUN ? ', DRY-RUN' : ''
    })…`,
  );

  let ok = 0;
  let falhas = 0;
  await runPool(urls, async (url, i) => {
    try {
      const doc = await parseDoc(url);
      if (!doc) {
        falhas++;
        return;
      }
      if (!DRY_RUN) {
        await prisma.legislationDocument.upsert({
          where: { url: doc.url },
          create: {
            titulo: doc.titulo,
            diploma: doc.diploma,
            orgao: doc.orgao,
            ano: doc.ano,
            fonte: 'LEXAO',
            publicacao: doc.publicacao,
            url: doc.url,
            conteudo: doc.conteudo,
          },
          update: {
            titulo: doc.titulo,
            diploma: doc.diploma,
            orgao: doc.orgao,
            ano: doc.ano,
            publicacao: doc.publicacao,
            conteudo: doc.conteudo,
          },
        });
      }
      ok++;
      if ((i + 1) % 25 === 0 || i + 1 === urls.length) {
        console.log(`  …${i + 1}/${urls.length} (${ok} ok, ${falhas} falhas)`);
      }
    } catch (e) {
      falhas++;
      console.warn(`  ✗ ${url}: ${(e as Error).message}`);
    }
  });

  console.log(`✔ Concluído: ${ok} importados, ${falhas} falhas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
