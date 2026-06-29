import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

export interface LegislacaoImportJob {
  /**
   * 'full' processa todo o lex.ao; 'incremental' salta os que já existem;
   * 'reguladores' corre os adaptadores dos sites oficiais (CMC, …).
   */
  mode: 'full' | 'incremental' | 'reguladores';
  orgaoFilter?: string;
  limit?: number;
}

type Processor = (job: LegislacaoImportJob) => Promise<void>;

const QUEUE_NAME = 'legislacao-import';

/**
 * Fila BullMQ para a ingestão de legislação (lex.ao). Espelha o padrão de
 * ImportQueueService: degrada para "sem fila" se não houver Redis (e nesse
 * caso a ingestão automática simplesmente não corre — nunca bloqueia o
 * arranque com um crawl síncrono de ~1.200 páginas).
 */
@Injectable()
export class LegislacaoImportQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LegislacaoImportQueueService.name);
  private queue?: Queue;
  private worker?: Worker;
  private connection?: Redis;
  private processor?: Processor;

  registerProcessor(fn: Processor): void {
    this.processor = fn;
  }

  /** Há fila activa (Redis disponível)? */
  get enabled(): boolean {
    return !!this.queue;
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    if (!redisUrl && !redisHost) {
      this.logger.log(
        'Sem REDIS_URL/REDIS_HOST — ingestão automática de legislação desactivada.',
      );
      return;
    }

    try {
      this.connection = redisUrl
        ? new IORedis(redisUrl, { maxRetriesPerRequest: null })
        : new IORedis({
            host: redisHost,
            port: Number(process.env.REDIS_PORT ?? 6379),
            maxRetriesPerRequest: null,
          });

      const connection = this.connection as unknown as ConnectionOptions;

      this.queue = new Queue(QUEUE_NAME, { connection });

      // concurrency 1: um único crawler de cada vez (gentil com o lex.ao).
      this.worker = new Worker(
        QUEUE_NAME,
        async (job) => {
          if (!this.processor) {
            throw new Error('Processor de legislação não registado');
          }
          await this.processor(job.data as LegislacaoImportJob);
        },
        { connection, concurrency: 1 },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Job de legislação ${job?.id} falhou: ${err?.message}`,
        );
      });
      this.worker.on('completed', (job) => {
        this.logger.log(`Job de legislação ${job?.id} concluído.`);
      });

      this.logger.log('Fila BullMQ de legislação activa.');
    } catch (e) {
      this.logger.warn(
        `Falha a iniciar a fila de legislação (${
          e instanceof Error ? e.message : e
        }); ingestão automática desactivada.`,
      );
      this.queue = undefined;
      this.worker = undefined;
    }
  }

  /**
   * Enfileira um job. `jobId` torna o enqueue idempotente — várias instâncias
   * a arrancar em simultâneo só criam UM job pendente com o mesmo id.
   */
  async enqueue(
    jobId: string,
    data: LegislacaoImportJob,
  ): Promise<'queued' | 'skipped'> {
    if (!this.queue) return 'skipped';
    await this.queue.add('processar', data, {
      jobId,
      removeOnComplete: 20,
      removeOnFail: 50,
      attempts: 1,
    });
    return 'queued';
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
