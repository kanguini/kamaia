import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

export interface ImportJob {
  loteId: string;
  tenantId: string;
  actorUserId: string;
}

type Processor = (job: ImportJob) => Promise<void>;

const QUEUE_NAME = 'importacao-lote';

/**
 * Fila de processamento de lotes de importação.
 *
 * Quando há Redis (env `REDIS_URL` ou `REDIS_HOST`), os lotes grandes
 * são processados ASSINCRONAMENTE por um Worker BullMQ — o pedido HTTP
 * devolve de imediato (lote fica EM_FILA/PROCESSANDO) e o cliente faz
 * polling de `GET /importacao/lotes/:id`.
 *
 * Sem Redis, degrada para processamento SÍNCRONO no próprio pedido —
 * o comportamento anterior, suficiente para dev e lotes pequenos. Em
 * ambos os casos a lógica de processamento é a mesma (o processor
 * registado por `ImportacaoService`), por isso não há divergência.
 */
@Injectable()
export class ImportQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportQueueService.name);
  private queue?: Queue;
  private worker?: Worker;
  private connection?: Redis;
  private processor?: Processor;

  /** `ImportacaoService` regista aqui a função que processa um lote. */
  registerProcessor(fn: Processor): void {
    this.processor = fn;
  }

  /** Há fila assíncrona disponível? (apenas com Redis configurado) */
  get isAsync(): boolean {
    return !!this.queue;
  }

  onModuleInit(): void {
    // Nunca abrir conexões/worker em testes — evita handles pendurados.
    if (process.env.NODE_ENV === 'test') return;
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    if (!redisUrl && !redisHost) {
      this.logger.log(
        'Sem REDIS_URL/REDIS_HOST — importação de lotes processa de forma síncrona.',
      );
      return;
    }
    try {
      // maxRetriesPerRequest: null é exigência do BullMQ para a conexão.
      this.connection = redisUrl
        ? new IORedis(redisUrl, { maxRetriesPerRequest: null })
        : new IORedis({
            host: redisHost,
            port: Number(process.env.REDIS_PORT ?? 6379),
            maxRetriesPerRequest: null,
          });

      // Cast: o BullMQ traz a sua própria cópia de ioredis; a instância
      // é compatível em runtime, só os tipos diferem entre as cópias.
      const connection = this.connection as unknown as ConnectionOptions;

      this.queue = new Queue(QUEUE_NAME, { connection });

      this.worker = new Worker(
        QUEUE_NAME,
        async (job) => {
          if (!this.processor) {
            throw new Error('Processor de importação não registado');
          }
          await this.processor(job.data as ImportJob);
        },
        { connection, concurrency: 2 },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Lote ${job?.data?.loteId} falhou na fila: ${err?.message}`,
        );
      });

      this.logger.log('Fila BullMQ de importação activa (processamento assíncrono).');
    } catch (e) {
      this.logger.warn(
        `Falha a iniciar a fila BullMQ (${e instanceof Error ? e.message : e}); ` +
          'a importação degrada para síncrono.',
      );
      this.queue = undefined;
      this.worker = undefined;
    }
  }

  /**
   * Enfileira um lote. Com Redis → adiciona job e devolve 'queued'
   * (não bloqueia). Sem Redis → processa inline (await) e devolve
   * 'inline'. `jobId: loteId` torna o enqueue idempotente.
   */
  async enqueue(data: ImportJob): Promise<'queued' | 'inline'> {
    if (this.queue) {
      await this.queue.add('processar', data, {
        jobId: data.loteId,
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 1,
      });
      return 'queued';
    }
    if (this.processor) {
      await this.processor(data);
    }
    return 'inline';
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
