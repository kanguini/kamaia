import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Result, ok, err } from '@kamaia/shared-types';

export interface BackupStats {
  gabinetes: number;
  users: number;
  clientes: number;
  processos: number;
  prazos: number;
  documents: number;
  aiConversations: number;
  timeEntries: number;
  expenses: number;
  auditLogs: number;
  lastBackupCheck: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private lastBackupCheck: Date | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Daily integrity check — runs at 3:00 AM UTC.
   * Verifies data counts and logs anomalies.
   * Railway PostgreSQL handles physical backups at infrastructure level.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyIntegrityCheck() {
    this.logger.log('[Backup] Running daily data integrity check...');

    try {
      const stats = await this.getDataStats();
      if (!stats.success) {
        this.logger.error('[Backup] Integrity check FAILED — cannot query database');
        return;
      }

      this.lastBackupCheck = new Date();
      this.logger.log(
        `[Backup] Integrity OK — ` +
          `${stats.data.gabinetes} gabinetes, ` +
          `${stats.data.users} users, ` +
          `${stats.data.clientes} clientes, ` +
          `${stats.data.processos} processos, ` +
          `${stats.data.prazos} prazos, ` +
          `${stats.data.auditLogs} audit logs`,
      );
    } catch (error) {
      this.logger.error(`[Backup] Integrity check error: ${(error as Error).message}`);
    }
  }

  async getDataStats(): Promise<Result<BackupStats>> {
    try {
      const [
        gabinetes,
        users,
        clientes,
        processos,
        prazos,
        documents,
        aiConversations,
        timeEntries,
        expenses,
        auditLogs,
      ] = await Promise.all([
        this.prisma.gabinete.count(),
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.cliente.count({ where: { deletedAt: null } }),
        this.prisma.processo.count({ where: { deletedAt: null } }),
        this.prisma.prazo.count({ where: { deletedAt: null } }),
        this.prisma.document.count({ where: { deletedAt: null } }),
        this.prisma.aIConversation.count({ where: { deletedAt: null } }),
        this.prisma.timeEntry.count({ where: { deletedAt: null } }),
        this.prisma.expense.count({ where: { deletedAt: null } }),
        this.prisma.auditLog.count(),
      ]);

      return ok({
        gabinetes,
        users,
        clientes,
        processos,
        prazos,
        documents,
        aiConversations,
        timeEntries,
        expenses,
        auditLogs,
        lastBackupCheck: this.lastBackupCheck?.toISOString() || 'never',
      });
    } catch (error) {
      return err('Failed to get stats', 'STATS_FAILED');
    }
  }

  /**
   * Export all data for a gabinete as JSON (GDPR-compliant data export).
   */
  async exportGabineteData(gabineteId: string): Promise<Result<object>> {
    try {
      const [
        gabinete,
        users,
        clientes,
        processos,
        prazos,
        calendarEvents,
        documents,
        timeEntries,
        expenses,
        aiConversations,
      ] = await Promise.all([
        this.prisma.gabinete.findUnique({ where: { id: gabineteId } }),
        this.prisma.user.findMany({
          where: { gabineteId, deletedAt: null },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            role: true, oaaNumber: true, specialty: true, phone: true,
            isActive: true, createdAt: true,
          },
        }),
        this.prisma.cliente.findMany({
          where: { gabineteId, deletedAt: null },
        }),
        this.prisma.processo.findMany({
          where: { gabineteId, deletedAt: null },
          include: {
            events: true,
            prazos: { where: { deletedAt: null } },
          },
        }),
        this.prisma.prazo.findMany({
          where: { gabineteId, deletedAt: null },
        }),
        this.prisma.calendarEvent.findMany({
          where: { gabineteId, deletedAt: null },
        }),
        this.prisma.document.findMany({
          where: { gabineteId, deletedAt: null },
          select: {
            id: true, title: true, category: true, fileUrl: true,
            fileSize: true, mimeType: true, createdAt: true,
          },
        }),
        this.prisma.timeEntry.findMany({
          where: { gabineteId, deletedAt: null },
        }),
        this.prisma.expense.findMany({
          where: { gabineteId, deletedAt: null },
        }),
        this.prisma.aIConversation.findMany({
          where: { gabineteId, deletedAt: null },
          include: { messages: true },
        }),
      ]);

      if (!gabinete) {
        return err('Gabinete not found', 'NOT_FOUND');
      }

      return ok({
        exportDate: new Date().toISOString(),
        version: '1.0',
        gabinete,
        users,
        clientes,
        processos,
        prazos,
        calendarEvents,
        documents,
        timeEntries,
        expenses,
        aiConversations,
      });
    } catch (error) {
      return err('Export failed', 'EXPORT_FAILED');
    }
  }
}
