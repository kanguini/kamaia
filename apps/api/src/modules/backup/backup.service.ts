import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';

export interface BackupExport {
  id: string;
  tenantId: string;
  requestedBy: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  estimatedSeconds: number;
  createdAt: string;
  url: string | null;
}

/**
 * BackupService — stub. Em produção delegará num job BullMQ que:
 *   1. Faz pg_dump filtrado por tenantId.
 *   2. Empacota documents de R2 com `tar.gz` streaming.
 *   3. Sobe o pacote para um bucket privado com URL assinado de 24h.
 *
 * Por agora mantemos um in-memory log apenas para o painel admin
 * exibir histórico durante dev.
 */
@Injectable()
export class BackupService {
  private readonly history: BackupExport[] = [];

  constructor(private readonly audit: AuditService) {}

  async requestExport(
    tenantId: string,
    actorUserId: string,
  ): Promise<BackupExport> {
    const entry: BackupExport = {
      id: randomUUID(),
      tenantId,
      requestedBy: actorUserId,
      status: 'queued',
      estimatedSeconds: 60,
      createdAt: new Date().toISOString(),
      url: null,
    };
    this.history.unshift(entry);
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.EXPORT,
      entityType: EntityType.TENANT,
      entityId: tenantId,
      afterData: { exportId: entry.id, estimatedSeconds: entry.estimatedSeconds },
    });
    return entry;
  }

  list(tenantId: string): BackupExport[] {
    return this.history.filter((e) => e.tenantId === tenantId);
  }
}
