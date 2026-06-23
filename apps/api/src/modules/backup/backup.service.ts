import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RestoreBackupDto, RestoreManifest } from './backup.dto';

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

  /**
   * Restaura um dump de backup para o tenant activo do actor.
   *
   * Decisões de segurança no MVP:
   *  - Apenas ADMIN pode chamar (enforced no controller).
   *  - `dryRun: true` é o default. O caller tem de optar explicitamente
   *    por escrever (`dryRun: false`).
   *  - Política de colisão: `skip` (default) mantém rows existentes;
   *    `error` aborta a transacção. **Nunca** sobreescrevemos rows
   *    activos — restaurar por cima parte FKs, histórico e estado.
   *  - `tenantId` em cada row é reescrito para o target. Memberships
   *    e AuditLog são saltados de propósito.
   *  - Toda a escrita corre numa transacção única. Em modo `error`
   *    com colisão, faz rollback automático.
   *
   * Devolve `RestoreManifest` com contagens por colecção, IDs em
   * colisão e total efectivamente escrito (zero em dry-run).
   */
  async restore(
    targetTenantId: string,
    actorUserId: string,
    dto: RestoreBackupDto,
  ): Promise<{ summary: BackupExport; manifest: RestoreManifest }> {
    // O payload pode vir embrulhado em { summary, payload } (formato do
    // ficheiro exportado) ou directamente como o dump (`{ meta, ... }`).
    const wrapped = dto.backup as Record<string, unknown>;
    const payload =
      (wrapped.payload as Record<string, unknown> | undefined) ??
      (wrapped as Record<string, unknown>);

    const meta = payload.meta as
      | { format?: string; version?: string; tenantId?: string }
      | undefined;
    if (!meta || meta.format !== 'kamaia-clm-backup') {
      throw new BadRequestException(
        'Payload não é um backup Kamaia CLM válido (meta.format ausente ou errado).',
      );
    }
    if (!meta.version || !/^1\.\d+$/.test(meta.version)) {
      throw new BadRequestException(
        `Versão de backup "${meta.version}" não suportada (apenas 1.x).`,
      );
    }

    const exportRow = await this.prisma.backupExport.create({
      data: {
        tenantId: targetTenantId,
        requestedBy: actorUserId,
        type: 'restore',
        status: 'running',
      },
    });

    try {
      const manifest = await this.applyRestore(
        targetTenantId,
        payload,
        dto.dryRun,
        dto.collisionPolicy,
      );

      manifest.backupVersion = meta.version;
      manifest.sourceTenantId = meta.tenantId ?? null;
      manifest.targetTenantId = targetTenantId;

      const updated = await this.prisma.backupExport.update({
        where: { id: exportRow.id },
        data: {
          status: 'done',
          completedAt: new Date(),
          manifest: {
            ...manifest,
            dryRun: dto.dryRun,
            collisionPolicy: dto.collisionPolicy,
          } as object,
        },
      });

      await this.audit.log({
        tenantId: targetTenantId,
        actorUserId,
        action: dto.dryRun ? AuditAction.READ : AuditAction.IMPORT,
        entityType: EntityType.TENANT,
        entityId: targetTenantId,
        afterData: {
          restoreId: updated.id,
          dryRun: dto.dryRun,
          totalWritten: manifest.totalWritten,
          backupVersion: manifest.backupVersion,
          sourceTenantId: manifest.sourceTenantId,
        },
      });

      return {
        manifest,
        summary: {
          id: updated.id,
          tenantId: targetTenantId,
          requestedBy: actorUserId,
          status: 'done',
          createdAt: updated.startedAt.toISOString(),
          completedAt: updated.completedAt?.toISOString() ?? null,
          sizeBytes: null,
          manifest: null,
          errorMessage: null,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Restore falhou para ${targetTenantId}: ${msg}`);
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

  /**
   * Ordem topológica de inserção (respeita FKs):
   *  Entidade → Carteira → TipoContrato → Template → Clausula →
   *  Contrato → ContratoVersao → ContratoParte → ContratoDataChave →
   *  ContratoObrigacao → ContratoActoRegulatorio →
   *  ContratoNegociacaoPonto → ContratoEvento → ContratoTerminacao →
   *  Document.
   *
   * Cada colecção:
   *  1. Filtra rows com IDs já existentes no target tenant (colisões).
   *  2. Em `error`, aborta. Em `skip`, exclui-os.
   *  3. Em escrita real, faz `createMany({ skipDuplicates: true })`
   *     com tenantId reescrito.
   */
  private async applyRestore(
    targetTenantId: string,
    payload: Record<string, unknown>,
    dryRun: boolean,
    collisionPolicy: 'skip' | 'error',
  ): Promise<RestoreManifest> {
    const collections: RestoreManifest['collections'] = {};
    const collisionIds: { collection: string; id: string }[] = [];
    let totalWritten = 0;

    type Plan = {
      key: keyof typeof payload;
      label: string;
      existingIds: () => Promise<Set<string>>;
      write: (
        tx: Prisma.TransactionClient,
        rows: Record<string, unknown>[],
      ) => Promise<number>;
      sanitise?: (row: Record<string, unknown>) => Record<string, unknown>;
    };

    const wrap = (s: string) => s as keyof typeof payload;

    const plans: Plan[] = [
      {
        key: wrap('entidades'),
        label: 'entidades',
        existingIds: async () =>
          new Set(
            (await this.prisma.entidade.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        // contactos/documentosKYC vêm aninhados — temos de strip-os
        // porque createMany não aceita nested.
        sanitise: (row) => {
          const { contactos: _c, documentosKYC: _k, ...rest } = row;
          return rest;
        },
        write: (tx, rows) =>
          tx.entidade
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('carteiras'),
        label: 'carteiras',
        existingIds: async () =>
          new Set(
            (await this.prisma.carteira.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.carteira
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('tiposCustom'),
        label: 'tiposCustom',
        existingIds: async () =>
          new Set(
            (await this.prisma.tipoContrato.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.tipoContrato
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('templates'),
        label: 'templates',
        existingIds: async () =>
          new Set(
            (await this.prisma.template.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.template
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('clausulas'),
        label: 'clausulas',
        existingIds: async () =>
          new Set(
            (await this.prisma.clausula.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.clausula
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('contratos'),
        label: 'contratos',
        existingIds: async () =>
          new Set(
            (await this.prisma.contrato.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contrato
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      // A partir daqui, child tables — não têm tenantId próprio, mas
      // referenciam contrato (que sim tem). Filtramos por contratoId
      // a apontar para um contrato deste tenant.
      {
        key: wrap('versoes'),
        label: 'versoes',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoVersao.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoVersao
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('partes'),
        label: 'partes',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoParte.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoParte
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('datasChave'),
        label: 'datasChave',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoDataChave.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoDataChave
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('obrigacoes'),
        label: 'obrigacoes',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoObrigacao.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        sanitise: (row) => {
          const { instancias: _i, ...rest } = row;
          return rest;
        },
        write: (tx, rows) =>
          tx.contratoObrigacao
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('actosRegulatorios'),
        label: 'actosRegulatorios',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoActoRegulatorio.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoActoRegulatorio
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('negociacaoPontos'),
        label: 'negociacaoPontos',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoNegociacaoPonto.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoNegociacaoPonto
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('eventos'),
        label: 'eventos',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoEvento.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoEvento
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('terminacoes'),
        label: 'terminacoes',
        existingIds: async () =>
          new Set(
            (await this.prisma.contratoTerminacao.findMany({
              where: { contrato: { tenantId: targetTenantId } },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.contratoTerminacao
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
      {
        key: wrap('documents'),
        label: 'documents',
        existingIds: async () =>
          new Set(
            (await this.prisma.document.findMany({
              where: { tenantId: targetTenantId },
              select: { id: true },
            })).map((r) => r.id),
          ),
        write: (tx, rows) =>
          tx.document
            .createMany({ data: rows as never, skipDuplicates: true })
            .then((r) => r.count),
      },
    ];

    // Pre-compute todos os splits (toCreate vs collisions) antes de
    // abrir transacção, para falhar early em modo `error` sem nunca
    // tocar no DB.
    type Split = {
      plan: Plan;
      toCreate: Record<string, unknown>[];
      collisions: string[];
      inBackup: number;
    };

    const splits: Split[] = [];

    for (const plan of plans) {
      const rawRows = (payload[plan.key] as Record<string, unknown>[]) ?? [];
      const existing = await plan.existingIds();
      const toCreate: Record<string, unknown>[] = [];
      const collisions: string[] = [];

      for (const r of rawRows) {
        const sanitised = plan.sanitise ? plan.sanitise(r) : r;
        // Reescrever tenantId só onde o modelo o tem.
        if ('tenantId' in sanitised) {
          sanitised.tenantId = targetTenantId;
        }
        this.reviveBigInts(sanitised);
        this.reviveDates(sanitised);

        const id = sanitised.id as string | undefined;
        if (id && existing.has(id)) {
          collisions.push(id);
          collisionIds.push({ collection: plan.label, id });
          if (collisionPolicy === 'error') {
            throw new BadRequestException(
              `Colisão de ID em "${plan.label}" (${id}). Política=error; restore abortado.`,
            );
          }
        } else {
          toCreate.push(sanitised);
        }
      }

      collections[plan.label] = {
        inBackup: rawRows.length,
        toCreate: toCreate.length,
        collisions: collisions.length,
        skipped: collisions.length,
      };
      splits.push({ plan, toCreate, collisions, inBackup: rawRows.length });
    }

    if (dryRun) {
      return {
        collections,
        collisionIds,
        totalWritten: 0,
        backupVersion: '',
        sourceTenantId: null,
        targetTenantId,
      };
    }

    // Escrita real numa transacção única — tudo ou nada.
    await this.prisma.$transaction(async (tx) => {
      for (const { plan, toCreate } of splits) {
        if (toCreate.length === 0) continue;
        const written = await plan.write(tx, toCreate);
        totalWritten += written;
      }
    });

    return {
      collections,
      collisionIds,
      totalWritten,
      backupVersion: '',
      sourceTenantId: null,
      targetTenantId,
    };
  }

  /**
   * BigInts vêm serializados como strings (e.g. "150000"). Detecta
   * campos conhecidos e converte. Lista alvo conservadora — preferimos
   * deixar passar como string a partir um BigInt errado num campo
   * que não devia ter sido tocado.
   */
  private reviveBigInts(row: Record<string, unknown>): void {
    const bigintFields = [
      'valorBaseCentavos',
      'valorMaxCentavos',
      'valorTotalCentavos',
      'montanteCentavos',
      'impostoCentavos',
      'baseTributavelCentavos',
      'valorCentavos',
      'fileSize',
      'sizeBytes',
    ];
    for (const f of bigintFields) {
      const v = row[f];
      if (typeof v === 'string' && /^-?\d+$/.test(v)) {
        try {
          row[f] = BigInt(v);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Datas em ISO string → Date. Prisma aceita ISO strings, mas
   * convertemos para uniformizar e evitar surpresas de timezone.
   */
  private reviveDates(row: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(row)) {
      if (
        typeof v === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)
      ) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) row[k] = d;
      }
    }
  }
}
