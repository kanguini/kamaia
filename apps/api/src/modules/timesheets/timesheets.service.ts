import { Injectable } from '@nestjs/common';
import { TimesheetsRepository, ListTimeEntriesParams } from './timesheets.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  KamaiaRole,
} from '@kamaia/shared-types';
import {
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from './timesheets.dto';

@Injectable()
export class TimesheetsService {
  constructor(
    private timesheetsRepository: TimesheetsRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    params: ListTimeEntriesParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      // If ADVOGADO_MEMBRO, filter by own entries
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        params.userId = userId;
      }

      const result = await this.timesheetsRepository.findAll(gabineteId, params);
      return ok(result);
    } catch (error) {
      return err('Failed to fetch time entries', 'TIME_ENTRIES_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const entry = await this.timesheetsRepository.findById(gabineteId, id);

      if (!entry) {
        return err('Time entry not found', 'TIME_ENTRY_NOT_FOUND');
      }

      // If ADVOGADO_MEMBRO, check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO && entry.userId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      return ok(entry);
    } catch (error) {
      return err('Failed to fetch time entry', 'TIME_ENTRY_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateTimeEntryDto,
  ): Promise<Result<any>> {
    try {
      // Verify processo exists and belongs to gabinete
      const processo = await this.prisma.processo.findFirst({
        where: {
          id: dto.processoId,
          gabineteId,
          deletedAt: null,
        },
      });

      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Create time entry
      const entry = await this.timesheetsRepository.create({
        ...dto,
        date: new Date(dto.date),
        gabineteId,
        userId,
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.DOCUMENT,
        entityId: entry.id,
        userId,
        gabineteId,
        newValue: {
          processoId: entry.processoId,
          category: entry.category,
          durationMinutes: entry.durationMinutes,
        },
      });

      return ok(entry);
    } catch (error) {
      return err('Failed to create time entry', 'TIME_ENTRY_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateTimeEntryDto,
  ): Promise<Result<any>> {
    try {
      // Check entry exists
      const existing = await this.timesheetsRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Time entry not found', 'TIME_ENTRY_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.userId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Update
      const updateData: any = { ...dto };
      if (dto.date) {
        updateData.date = new Date(dto.date);
      }

      const entry = await this.timesheetsRepository.update(
        gabineteId,
        id,
        updateData,
      );
      if (!entry) {
        return err('Time entry not found after update', 'TIME_ENTRY_NOT_FOUND');
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.DOCUMENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { durationMinutes: existing.durationMinutes },
        newValue: { durationMinutes: entry.durationMinutes },
      });

      return ok(entry);
    } catch (error) {
      return err('Failed to update time entry', 'TIME_ENTRY_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.timesheetsRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Time entry not found', 'TIME_ENTRY_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.userId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.timesheetsRepository.softDelete(gabineteId, id);

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.DOCUMENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: {
          processoId: existing.processoId,
          durationMinutes: existing.durationMinutes,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete time entry', 'TIME_ENTRY_DELETE_FAILED');
    }
  }

  async getSummary(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Result<any>> {
    try {
      const summary = await this.timesheetsRepository.getSummary(
        gabineteId,
        dateFrom,
        dateTo,
      );

      // If ADVOGADO_MEMBRO, filter by processos they own
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        const userProcessos = await this.prisma.processo.findMany({
          where: {
            gabineteId,
            advogadoId: userId,
            deletedAt: null,
          },
          select: { id: true },
        });

        const processoIds = new Set(userProcessos.map((p) => p.id));
        const filtered = summary.filter((s: any) => processoIds.has(s.processoId));
        return ok(filtered);
      }

      return ok(summary);
    } catch (error) {
      return err('Failed to fetch summary', 'SUMMARY_FETCH_FAILED');
    }
  }
}
