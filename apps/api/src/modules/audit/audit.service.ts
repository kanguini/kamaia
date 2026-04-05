import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditLogEntry } from '@kamaia/shared-types';

@Injectable()
export class AuditService {
  constructor(private auditRepository: AuditRepository) {}

  async log(entry: AuditLogEntry & { userAgent?: string }): Promise<void> {
    try {
      await this.auditRepository.create(entry);
    } catch (error) {
      // Append-only — NEVER throw on audit failure
      // Log to monitoring system instead
      console.error('Audit log failed:', error);
    }
  }
}
