import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withGabinete<T>(gabineteId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    // Defense in depth: regex validates UUID format before we ever build SQL,
    // and we then bind gabineteId as a parameter ($1) instead of interpolating
    // it into the SQL string. Even if a malicious value bypassed the regex
    // (e.g. via a different code path) the Postgres protocol would treat it
    // as a literal value, not SQL.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gabineteId)) {
      throw new Error(`Invalid gabineteId format: ${gabineteId}`);
    }

    return this.$transaction(async (tx) => {
      // Tagged template — Prisma binds ${gabineteId} as $1 in the prepared statement.
      await tx.$executeRaw`SELECT set_config('app.current_gabinete_id', ${gabineteId}, true)`;
      return callback(tx as unknown as PrismaClient);
    });
  }
}
