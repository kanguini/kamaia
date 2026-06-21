import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditLogEntry, EntityType } from '@kamaia/shared-types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AuditService — escrita append-only do `audit_logs`.
 *
 * - Nunca throwa: falhar a auditoria não deve quebrar a operação de negócio.
 *   Erros são logados a Sentry (via Logger) mas a request continua.
 * - Aceita `tenantId` nulo para eventos pré-tenancy (LOGIN_FAILED).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          beforeData: entry.beforeData as object | undefined,
          afterData: entry.afterData as object | undefined,
          ipAddress: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (e) {
      this.logger.error(
        `Failed to write audit log: ${entry.action} ${entry.entityType}/${entry.entityId}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  async query(opts: {
    tenantId: string;
    entityType?: EntityType;
    entityId?: string;
    action?: AuditAction;
    actorUserId?: string;
    limit?: number;
    cursor?: string;
  }) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId: opts.tenantId,
        ...(opts.entityType && { entityType: opts.entityType }),
        ...(opts.entityId && { entityId: opts.entityId }),
        ...(opts.action && { action: opts.action }),
        ...(opts.actorUserId && { actorUserId: opts.actorUserId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    });
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }
}
