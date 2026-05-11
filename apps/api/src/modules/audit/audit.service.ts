import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { AuditRepository } from './audit.repository';
import { AuditLogEntry } from '@kamaia/shared-types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private auditRepository: AuditRepository) {}

  async log(entry: AuditLogEntry & { userAgent?: string }): Promise<void> {
    try {
      await this.auditRepository.create(entry);
    } catch (error) {
      // Append-only — NEVER throw on audit failure. Mas tem de chegar a
      // alguém: Sentry (se configurado) + Logger do Nest (Railway logs).
      // Falha aqui é silenciosa para o caller mas crítica para compliance —
      // se gravarmos LOGIN_FAILED 100× e o audit cai, perdemos forense.
      this.logger.error(
        `Audit log failed for ${entry.action}/${entry.entity}`,
        error as Error,
      );
      Sentry.captureException(error, {
        tags: {
          audit_action: entry.action,
          audit_entity: entry.entity,
        },
        extra: {
          gabineteId: entry.gabineteId,
          userId: entry.userId,
          entityId: entry.entityId,
        },
      });
    }
  }
}
