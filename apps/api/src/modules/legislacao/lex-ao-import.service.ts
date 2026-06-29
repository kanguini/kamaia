import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import {
  LegislacaoImportJob,
  LegislacaoImportQueueService,
} from './legislacao-import-queue.service';
import {
  LEX_SITEMAP,
  LEX_UA,
  chunkConteudo,
  extractDocUrls,
  parseDocFromHtml,
} from './lex-ao.parse';

/**
 * Ingestão automática de legislação a partir do lex.ao — sem intervenção
 * manual. Em produção (Redis presente):
 *   • ~45s após o arranque, se o corpus LEXAO estiver vazio, enfileira o
 *     crawl completo (~1.200 diplomas) em background;
 *   • semanalmente, enfileira um refresh incremental (só diplomas novos).
 *
 * Cada diploma novo é fragmentado e embedded via RagService → o Dr. Kamaia
 * passa a citá-los. Sem OPENAI_API_KEY, os chunks ficam sem vector e a
 * pesquisa cai no modo textual (à mesma utilizável).
 *
 * Desligar com LEXAO_AUTO_IMPORT=false. O crawl NUNCA corre inline: sem
 * Redis, a ingestão automática fica simplesmente inactiva (não bloqueia o
 * arranque). Parsing puro em lex-ao.parse.ts.
 */
@Injectable()
export class LexAoImportService implements OnModuleInit {
  private readonly logger = new Logger(LexAoImportService.name);
  private readonly concurrency = Number(process.env.LEXAO_CONCURRENCY ?? 4);
  private readonly delayMs = Number(process.env.LEXAO_DELAY_MS ?? 250);
  private readonly autoImport = process.env.LEXAO_AUTO_IMPORT !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: LegislacaoImportQueueService,
    private readonly rag: RagService,
  ) {}

  onModuleInit(): void {
    this.queue.registerProcessor((job) => this.processar(job));
  }

  @Timeout(45_000)
  async bootstrapImport(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || !this.autoImport) return;
    const count = await this.prisma.legislationDocument.count({
      where: { fonte: 'LEXAO' },
    });
    if (count > 0) {
      this.logger.log(`Corpus lex.ao já tem ${count} diplomas — sem import inicial.`);
      return;
    }
    const r = await this.dispararImport({ mode: 'full' }, 'arranque');
    this.logger.log(`Import inicial: ${r.via}/${r.estado}.`);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async weeklyRefresh(): Promise<void> {
    if (!this.autoImport) return;
    await this.dispararImport({ mode: 'incremental' }, 'semanal');
  }

  /**
   * Dispara um import. Se houver fila (Redis), enfileira no BullMQ. Caso
   * contrário, corre NO PRÓPRIO PROCESSO em background (não bloqueia o
   * arranque nem os pedidos) — assim a ingestão funciona mesmo sem a
   * variável REDIS_URL configurada. `running` evita corridas concorrentes
   * dentro da mesma instância.
   */
  async dispararImport(
    job: LegislacaoImportJob,
    origem: string,
  ): Promise<{ via: 'fila' | 'in-process'; estado: string }> {
    if (this.queue.enabled) {
      const estado = await this.queue.enqueue(`lexao-${job.mode}`, job);
      return { via: 'fila', estado };
    }
    if (this.running) {
      return { via: 'in-process', estado: 'ja-a-correr' };
    }
    this.logger.log(`Import (${origem}) a correr em background, sem fila.`);
    void this.runDetached(job);
    return { via: 'in-process', estado: 'iniciado' };
  }

  private running = false;
  private async runDetached(job: LegislacaoImportJob): Promise<void> {
    this.running = true;
    try {
      await this.processar(job);
    } catch (e) {
      this.logger.error(`Import em background falhou: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  // ─── processamento (corre no worker BullMQ) ─────────────────
  async processar(job: LegislacaoImportJob): Promise<void> {
    this.logger.log(`A ler o sitemap do lex.ao (${job.mode})…`);
    const xml = await this.fetchText(LEX_SITEMAP);
    let urls = extractDocUrls(xml, job.orgaoFilter);

    if (job.mode === 'incremental') {
      const existentes = new Set(
        (
          await this.prisma.legislationDocument.findMany({
            where: { fonte: 'LEXAO' },
            select: { url: true },
          })
        )
          .map((r) => r.url)
          .filter((u): u is string => !!u),
      );
      urls = urls.filter((u) => !existentes.has(u));
    }
    if (job.limit && urls.length > job.limit) urls = urls.slice(0, job.limit);

    this.logger.log(`A processar ${urls.length} diplomas…`);
    let ok = 0;
    let falhas = 0;

    await this.pool(urls, async (url) => {
      try {
        const html = await this.fetchText(url);
        const doc = parseDocFromHtml(url, html);
        if (!doc) {
          falhas++;
          return;
        }
        const existente = await this.prisma.legislationDocument.findUnique({
          where: { url: doc.url },
          select: { id: true },
        });
        if (existente) {
          // Refresh de metadados; não re-fragmenta (evita duplicar chunks).
          await this.prisma.legislationDocument.update({
            where: { id: existente.id },
            data: {
              titulo: doc.titulo,
              diploma: doc.diploma,
              orgao: doc.orgao,
              ano: doc.ano,
              publicacao: doc.publicacao,
              conteudo: doc.conteudo,
            },
          });
        } else {
          const created = await this.prisma.legislationDocument.create({
            data: {
              titulo: doc.titulo,
              diploma: doc.diploma,
              orgao: doc.orgao,
              ano: doc.ano,
              fonte: 'LEXAO',
              publicacao: doc.publicacao,
              url: doc.url,
              conteudo: doc.conteudo,
            },
            select: { id: true },
          });
          await this.chunkAndEmbed(created.id, doc.conteudo);
        }
        ok++;
      } catch (e) {
        falhas++;
        this.logger.warn(`✗ ${url}: ${(e as Error).message}`);
      }
    });

    this.logger.log(`Legislação concluída: ${ok} ok, ${falhas} falhas.`);
  }

  private async chunkAndEmbed(documentId: string, conteudo: string): Promise<void> {
    const trechos = chunkConteudo(conteudo);
    if (trechos.length === 0) return;
    try {
      await this.rag.addChunks(documentId, {
        chunks: trechos.map((trecho, i) => ({ trecho, ordem: i })),
      });
    } catch (e) {
      this.logger.warn(
        `Chunks/embeddings falharam para ${documentId}: ${(e as Error).message}`,
      );
    }
  }

  private async fetchText(url: string, retries = 3): Promise<string> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': LEX_UA } });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (e) {
        if (attempt === retries) throw e;
        await sleep(500 * (attempt + 1));
      }
    }
    throw new Error('unreachable');
  }

  private async pool(
    items: string[],
    worker: (item: string, index: number) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const runNext = async (): Promise<void> => {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i], i);
      if (i % this.concurrency === 0) await sleep(this.delayMs);
      return runNext();
    };
    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, items.length) }, () =>
        runNext(),
      ),
    );
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
