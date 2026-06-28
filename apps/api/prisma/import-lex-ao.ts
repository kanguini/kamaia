/**
 * Importador manual de legislação do lex.ao → LegislationDocument.
 *
 * NOTA: em produção isto corre SOZINHO via LexAoImportService (job BullMQ
 * que arranca quando o corpus está vazio + refresh semanal). Este script é
 * só um fallback manual / ferramenta de smoke-test. Reutiliza o MESMO parser
 * (src/modules/legislacao/lex-ao.parse.ts) — uma única fonte da verdade.
 *
 *   cd apps/api
 *   npx prisma migrate deploy
 *   npx prisma generate
 *   npx ts-node prisma/import-lex-ao.ts --limit 5 --dry-run
 *   npx ts-node prisma/import-lex-ao.ts            # corpus completo
 *
 * Flags: --limit N | --concurrency N | --delay MS | --skip-existing |
 *        --dry-run | --orgao SLUG
 *
 * Este script NÃO faz chunking/embeddings (o serviço em produção faz). Serve
 * para popular/validar os documentos.
 */

import { PrismaClient } from '@prisma/client';
import {
  LEX_SITEMAP,
  LEX_UA,
  extractDocUrls,
  parseDocFromHtml,
} from '../src/modules/legislacao/lex-ao.parse';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const LIMIT = arg('limit') ? parseInt(arg('limit')!, 10) : Infinity;
const CONCURRENCY = arg('concurrency') ? parseInt(arg('concurrency')!, 10) : 4;
const DELAY = arg('delay') ? parseInt(arg('delay')!, 10) : 250;
const SKIP_EXISTING = flag('skip-existing');
const DRY_RUN = flag('dry-run');
const ORGAO_FILTER = arg('orgao');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': LEX_UA } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error('unreachable');
}

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
  const xml = await fetchText(LEX_SITEMAP);
  let urls = extractDocUrls(xml, ORGAO_FILTER);
  console.log(`  ${urls.length} diplomas no sitemap.`);

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
    `▶ A processar ${urls.length} (concorrência ${CONCURRENCY}${DRY_RUN ? ', DRY-RUN' : ''})…`,
  );

  let ok = 0;
  let falhas = 0;
  await runPool(urls, async (url, i) => {
    try {
      const html = await fetchText(url);
      const doc = parseDocFromHtml(url, html);
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
