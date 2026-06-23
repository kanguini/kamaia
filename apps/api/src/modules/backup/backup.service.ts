import { Injectable, Logger } from '@nestjs/common';
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
  manifest: BackupManifest | null;
  errorMessage: string | null;
}

interface BackupManifest {
  contratos: number;
  entidades: number;
  carteiras: number;
  actosRegulatorios: number;
  versoes: number;
  documents: number;
  auditLogs: number;
}

/**
 * BackupService — dump JSON real por tenant.
 *
 * AUDIT fix: histórico em-memória perdia-se em cada restart do API.
 * Agora persiste em `backup_exports` table com retenção via TTL
 * (job futuro de cleanup). Cada run cria a row com status=running
 * antes de começar; actualiza para done/failed no fim.
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string): Promise<BackupExport[]> {
    const rows = await this.prisma.backupExport.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      requestedBy: r.requestedBy,
      status: r.status as BackupExport['status'],
      createdAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      sizeBytes: r.sizeBytes !== null ? Number(r.sizeBytes) : null,
      manifest: (r.manifest as BackupManifest | null) ?? null,
      errorMessage: r.errorMessage,
    }));
  }

  async generateDump(
    tenantId: string,
    actorUserId: string,
  ): Promise<{ summary: BackupExport; data: object }> {
    // Cria entrada persistente — sobrevive a restart
    const exportRow = await this.prisma.backupExport.create({
      data: {
        tenantId,
        requestedBy: actorUserId,
        status: 'running',
      },
    });

    try {
      const data = await this.collect(tenantId);
      const json = this.stringifyBigInt(data);
      const manifest: BackupManifest = {
        contratos: (data.contratos as unknown[]).length,
        entidades: (data.entidades as unknown[]).length,
        carteiras: (data.carteiras as unknown[]).length,
        actosRegulatorios: (data.actosRegulatorios as unknown[]).length,
        versoes: (data.versoes as unknown[]).length,
        documents: (data.documents as unknown[]).length,
        auditLogs: (data.auditLogs as unknown[]).length,
      };

      const updated = await this.prisma.backupExport.update({
        where: { id: exportRow.id },
        data: {
          status: 'done',
          completedAt: new Date(),
          sizeBytes: BigInt(Buffer.byteLength(json, 'utf8')),
          manifest: manifest as object,
        },
      });

      await this.audit.log({
        tenantId,
        actorUserId,
        action: AuditAction.EXPORT,
        entityType: EntityType.TENANT,
        entityId: tenantId,
        afterData: {
          exportId: updated.id,
          sizeBytes: updated.sizeBytes?.toString(),
          manifest,
        },
      });

      return {
        summary: {
          id: updated.id,
          tenantId,
          requestedBy: actorUserId,
          status: 'done',
          createdAt: updated.startedAt.toISOString(),
          completedAt: updated.completedAt?.toISOString() ?? null,
          sizeBytes: Number(updated.sizeBytes ?? 0),
          manifest,
          errorMessage: null,
        },
        data,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Backup falhou para ${tenantId}: ${msg}`);
      await this.prisma.backupExport.update({
        where: { id: exportRow.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: msg,
        },
      });
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
