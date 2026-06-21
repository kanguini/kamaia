import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executa `callback` dentro de uma transacção com `app.current_tenant_id`
   * configurado — útil para RLS futura. `tenantId` é validado como UUID
   * para evitar SQL injection mesmo com binding paramétrico.
   */
  async withTenant<T>(
    tenantId: string,
    callback: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
    ) {
      throw new Error(`Invalid tenantId format: ${tenantId}`);
    }

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return callback(tx as unknown as PrismaClient);
    });
  }
}
