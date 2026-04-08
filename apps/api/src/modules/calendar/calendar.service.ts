import { Injectable } from '@nestjs/common';
import { CalendarRepository, ListEventsFilters } from './calendar.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  AuditAction,
  EntityType,
  KamaiaRole,
  ProcessoEventType,
} from '@kamaia/shared-types';
import { CreateEventDto, UpdateEventDto } from './calendar.dto';

@Injectable()
export class CalendarService {
  constructor(
    private calendarRepository: CalendarRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findByDateRange(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    startDate: string,
    endDate: string,
    filters?: ListEventsFilters,
  ): Promise<Result<any[]>> {
    try {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      // Get regular calendar events
      const events = await this.calendarRepository.findByDateRange(
        gabineteId,
        startDateObj,
        endDateObj,
        filters,
      );

      // Get prazos as virtual events (only if not filtering by type or type=PRAZO)
      let prazoEvents: any[] = [];
      if (!filters?.type || filters.type === 'PRAZO') {
        prazoEvents = await this.calendarRepository.findPrazosAsEvents(
          gabineteId,
          startDateObj,
          endDateObj,
        );
      }

      // Mark regular events with source
      const regularEvents = events.map((event) => ({
        ...event,
        source: 'event' as const,
      }));

      // Merge both arrays
      let combined = [...regularEvents, ...prazoEvents];

      // Filter by processoId if provided
      if (filters?.processoId) {
        combined = combined.filter(
          (item) => item.processoId === filters.processoId,
        );
      }

      // For ADVOGADO_MEMBRO: filter to only events they own + processo events for their processos
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        // Get user's processos
        const userProcessos = await this.prisma.processo.findMany({
          where: {
            gabineteId,
            advogadoId: userId,
            deletedAt: null,
          },
          select: { id: true },
        });

        const processoIds = new Set(userProcessos.map((p) => p.id));

        combined = combined.filter((item) => {
          // Own events
          if (item.source === 'event' && item.userId === userId) {
            return true;
          }
          // Processo events for their processos
          if (item.processoId && processoIds.has(item.processoId)) {
            return true;
          }
          return false;
        });
      }

      // Sort by startAt
      combined.sort((a, b) => {
        const aDate = new Date(a.startAt);
        const bDate = new Date(b.startAt);
        return aDate.getTime() - bDate.getTime();
      });

      return ok(combined);
    } catch (error) {
      return err('Failed to fetch calendar events', 'CALENDAR_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const event = await this.calendarRepository.findById(gabineteId, id);

      if (!event) {
        return err('Calendar event not found', 'CALENDAR_EVENT_NOT_FOUND');
      }

      // For ADVOGADO_MEMBRO: check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        // Either owner of the event, or owner of the processo
        if (
          event.userId !== userId &&
          (!event.processo || event.processo.advogadoId !== userId)
        ) {
          return err('Access denied', 'ACCESS_DENIED');
        }
      }

      return ok(event);
    } catch (error) {
      return err('Failed to fetch calendar event', 'CALENDAR_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateEventDto,
  ): Promise<Result<any>> {
    try {
      // Verify processo exists if provided
      if (dto.processoId) {
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
      }

      // Create calendar event
      const event = await this.calendarRepository.create({
        ...dto,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        gabineteId,
        userId,
      });

      // If type=AUDIENCIA and processoId exists, create ProcessoEvent
      if (dto.type === 'AUDIENCIA' && dto.processoId) {
        await this.prisma.processoEvent.create({
          data: {
            processoId: dto.processoId,
            userId,
            type: ProcessoEventType.HEARING,
            description: `Audiencia agendada: ${dto.title} — ${new Date(dto.startAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`,
            metadata: {
              calendarEventId: event.id,
              location: dto.location,
              startAt: dto.startAt,
            },
          },
        });
      }

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: event.id,
        userId,
        gabineteId,
        newValue: {
          title: event.title,
          type: event.type,
          startAt: event.startAt,
        },
      });

      return ok(event);
    } catch (error) {
      return err('Failed to create calendar event', 'CALENDAR_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateEventDto,
  ): Promise<Result<any>> {
    try {
      // Check event exists
      const existing = await this.calendarRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Calendar event not found', 'CALENDAR_EVENT_NOT_FOUND');
      }

      // Check ownership: creator or SOCIO_GESTOR
      if (
        role !== KamaiaRole.SOCIO_GESTOR &&
        role !== KamaiaRole.ADVOGADO_SOLO &&
        existing.userId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Prepare update data
      const updateData: any = { ...dto };
      if (dto.startAt) {
        updateData.startAt = new Date(dto.startAt);
      }
      if (dto.endAt) {
        updateData.endAt = new Date(dto.endAt);
      }

      const event = await this.calendarRepository.update(
        gabineteId,
        id,
        updateData,
      );

      if (!event) {
        return err(
          'Calendar event not found after update',
          'CALENDAR_EVENT_NOT_FOUND',
        );
      }

      // Audit log
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
        newValue: { title: event.title },
      });

      return ok(event);
    } catch (error) {
      return err('Failed to update calendar event', 'CALENDAR_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.calendarRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Calendar event not found', 'CALENDAR_EVENT_NOT_FOUND');
      }

      // Check ownership: creator or SOCIO_GESTOR
      if (
        role !== KamaiaRole.SOCIO_GESTOR &&
        role !== KamaiaRole.ADVOGADO_SOLO &&
        existing.userId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.calendarRepository.softDelete(gabineteId, id);

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete calendar event', 'CALENDAR_DELETE_FAILED');
    }
  }
}
