import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListEventsFilters {
  type?: string;
  processoId?: string;
}

@Injectable()
export class CalendarRepository {
  constructor(private prisma: PrismaService) {}

  async findByDateRange(
    gabineteId: string,
    startDate: Date,
    endDate: Date,
    filters?: ListEventsFilters,
  ) {
    const where: any = {
      gabineteId,
      deletedAt: null,
      OR: [
        {
          startAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          endAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          AND: [
            { startAt: { lte: startDate } },
            { endAt: { gte: endDate } },
          ],
        },
      ],
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.processoId) {
      where.processoId = filters.processoId;
    }

    return this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        location: true,
        startAt: true,
        endAt: true,
        allDay: true,
        reminderMinutes: true,
        userId: true,
        processoId: true,
        createdAt: true,
        updatedAt: true,
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
      },
    });
  }

  async findPrazosAsEvents(
    gabineteId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const prazos = await this.prisma.prazo.findMany({
      where: {
        gabineteId,
        deletedAt: null,
        status: 'PENDENTE',
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        dueDate: true,
        isUrgent: true,
        status: true,
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
      },
    });

    // Map prazos to virtual calendar event format
    return prazos.map((prazo) => ({
      id: prazo.id,
      source: 'prazo' as const,
      title: prazo.title,
      description: prazo.description,
      type: 'PRAZO',
      startAt: prazo.dueDate,
      endAt: prazo.dueDate,
      allDay: false,
      isUrgent: prazo.isUrgent,
      processo: prazo.processo,
      prazoId: prazo.id,
      prazoStatus: prazo.status,
      prazoType: prazo.type,
    }));
  }

  async findById(gabineteId: string, id: string) {
    return this.prisma.calendarEvent.findFirst({
      where: {
        id,
        gabineteId,
        deletedAt: null,
      },
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
            advogadoId: true,
          },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.calendarEvent.create({
      data,
      include: {
        processo: {
          select: {
            id: true,
            processoNumber: true,
            title: true,
          },
        },
      },
    });
  }

  async update(gabineteId: string, id: string, data: any) {
    await this.prisma.calendarEvent.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data,
    });
    return this.findById(gabineteId, id);
  }

  async softDelete(gabineteId: string, id: string) {
    return this.prisma.calendarEvent.updateMany({
      where: { id, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
