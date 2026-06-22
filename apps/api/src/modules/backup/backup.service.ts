import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface BackupExport {
  id: string;
  tenantId: string;
  requestedBy: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  createdAt: string;
  completedAt: string | null;
  sizeBytes: number | null;
  manifest: {
    contratos: number;
    entidades: number;
    carteiras: number;
    actosRegulatorios: number;
    versoes: number;
    documents: number;
    auditLogs: number;
  } | null;
  errorMessage: string | null;
}

/**
 * BackupService — dump JSON real por tenant.
 *
 * Estratégia:
 *   - Snapshot síncrono em-memória para datasets pequenos/médios
 *     (até ~10k contratos por tenant)
 *   - Exclui blobs físicos (apenas metadata + storageKey)
 *   - BigInt → string para preservar precisão monetária
 *
 * Para datasets grandes, mover para streaming + worker BullMQ.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly history: BackupExport[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string): BackupExport[] {
    return this.history.filter((e) => e.tenantId === tenantId).slice(0, 50);
  }

  async generateDump(
    tenantId: string,
    actorUserId: string,
  ): Promise<{ summary: BackupExport; data: object }> {
    const entry: BackupExport = {
      id: randomUUID(),
      tenantId,
      requestedBy: actorUserId,
      status: 'running',
      createdAt: new Date().toISOString(),
      completedAt: null,
      sizeBytes: null,
      manifest: null,
      errorMessage: null,
    };
    this.history.unshift(entry);

    try {
      const data = await this.collect(tenantId);
      const json = this.stringifyBigInt(data);
      entry.status = 'done';
      entry.completedAt = new Date().toISOString();
      entry.sizeBytes = Buffer.byteLength(json, 'utf8');
      entry.manifest = {
        contratos: (data.contratos as unknown[]).length,
        entidades: (data.entidades as unknown[]).length,
        carteiras: (data.carteiras as unknown[]).length,
        actosRegulatorios: (data.actosRegulatorios as unknown[]).length,
        versoes: (data.versoes as unknown[]).length,
        documents: (data.documents as unknown[]).length,
        auditLogs: (data.auditLogs as unknown[]).length,
      };

      await this.audit.log({
        tenantId,
        actorUserId,
        action: AuditAction.EXPORT,
        entityType: EntityType.TENANT,
        entityId: tenantId,
        afterData: {
          exportId: entry.id,
          sizeBytes: entry.sizeBytes,
          manifest: entry.manifest,
        },
      });

      return { summary: entry, data };
    } catch (e) {
      entry.status = 'failed';
      entry.completedAt = new Date().toISOString();
      entry.errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.error(`Backup falhou para ${tenantId}: ${entry.errorMessage}`);
      throw e;
    }
  }

  private async collect(tenantId: string): Promise<Record<string, unknown>> {
    const [
      tenant,
      memberships,
      entidades,
      carteiras,
      tiposCustom,
      templates,
      clausulas,
      contratos,
      versoes,
      partes,
      datasChave,
      obrigacoes,
      actosRegulatorios,
      negociacaoPontos,
      eventos,
      terminacoes,
      documents,
      auditLogs,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.membership.findMany({
        where: { tenantId },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.entidade.findMany({
        where: { tenantId },
        include: { contactos: true, documentosKYC: true },
      }),
      this.prisma.carteira.findMany({ where: { tenantId } }),
      this.prisma.tipoContrato.findMany({ where: { tenantId } }),
      this.prisma.template.findMany({ where: { tenantId } }),
      this.prisma.clausula.findMany({ where: { tenantId } }),
      this.prisma.contrato.findMany({ where: { tenantId } }),
      this.prisma.contratoVersao.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.contratoParte.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.contratoDataChave.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.contratoObrigacao.findMany({
        where: { contrato: { tenantId } },
        include: { instancias: true },
      }),
      this.prisma.contratoActoRegulatorio.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.contratoNegociacaoPonto.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.contratoEvento.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.contratoTerminacao.findMany({ where: { contrato: { tenantId } } }),
      this.prisma.document.findMany({ where: { tenantId } }),
      this.prisma.auditLog.findMany({
        where: { tenantId },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      meta: {
        format: 'kamaia-clm-backup',
        version: '1.0',
        generatedAt: new Date().toISOString(),
        tenantId,
      },
      tenant,
      memberships,
      entidades,
      carteiras,
      tiposCustom,
      templates,
      clausulas,
      contratos,
      versoes,
      partes,
      datasChave,
      obrigacoes,
      actosRegulatorios,
      negociacaoPontos,
      eventos,
      terminacoes,
      documents,
      auditLogs,
    };
  }

  private stringifyBigInt(obj: unknown): string {
    return JSON.stringify(obj, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
  }
}
