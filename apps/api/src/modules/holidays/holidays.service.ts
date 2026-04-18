import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Result, ok, err } from '@kamaia/shared-types';
import {
  addBusinessDays,
  countBusinessDaysBetween,
  getAngolanHolidays,
  rollForwardIfNonBusiness,
} from './business-days.util';

/**
 * Holidays + business-day arithmetic for a gabinete.
 * System holidays (gabineteId null) are auto-seeded for the current +
 * next year the first time a gabinete asks for anything.
 */
@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  async list(
    gabineteId: string,
    year?: number,
  ): Promise<Result<any[]>> {
    try {
      await this.ensureSystemSeeded();
      const targetYear = year ?? new Date().getUTCFullYear();
      const start = new Date(Date.UTC(targetYear, 0, 1));
      const end = new Date(Date.UTC(targetYear + 1, 0, 1));
      const rows = await this.prisma.holiday.findMany({
        where: {
          OR: [{ gabineteId: null }, { gabineteId }],
          date: { gte: start, lt: end },
        },
        orderBy: { date: 'asc' },
      });
      return ok(rows);
    } catch (e) {
      return err('Failed to list holidays', 'HOLIDAYS_LIST_FAILED');
    }
  }

  async createGabineteHoliday(
    gabineteId: string,
    input: { name: string; date: string; kind?: string; recurring?: boolean; notes?: string },
  ): Promise<Result<any>> {
    try {
      const row = await this.prisma.holiday.create({
        data: {
          gabineteId,
          name: input.name,
          date: new Date(input.date),
          kind: (input.kind as any) ?? 'MUNICIPAL',
          recurring: !!input.recurring,
          notes: input.notes ?? null,
        },
      });
      return ok(row);
    } catch (e) {
      return err('Failed to create holiday', 'HOLIDAY_CREATE_FAILED');
    }
  }

  async deleteGabineteHoliday(
    gabineteId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      const h = await this.prisma.holiday.findFirst({
        where: { id, gabineteId },
      });
      if (!h) return err('Holiday not found', 'HOLIDAY_NOT_FOUND');
      await this.prisma.holiday.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err('Failed to delete holiday', 'HOLIDAY_DELETE_FAILED');
    }
  }

  /**
   * Returns ISO date keys (YYYY-MM-DD) for holidays affecting this gabinete
   * across the requested year span. Used by the business-day helpers.
   */
  async holidayKeysForRange(
    gabineteId: string,
    fromYear: number,
    toYear: number,
  ): Promise<Set<string>> {
    await this.ensureSystemSeeded();
    const rows = await this.prisma.holiday.findMany({
      where: {
        OR: [{ gabineteId: null }, { gabineteId }],
        date: {
          gte: new Date(Date.UTC(fromYear, 0, 1)),
          lt: new Date(Date.UTC(toYear + 1, 0, 1)),
        },
      },
      select: { date: true },
    });
    return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
  }

  async addBusinessDays(
    gabineteId: string,
    startDate: Date,
    days: number,
  ): Promise<Date> {
    const span = Math.max(1, Math.ceil(days / 200) + 1); // safety margin
    const fromYear = startDate.getUTCFullYear();
    const toYear = fromYear + span;
    const keys = await this.holidayKeysForRange(gabineteId, fromYear, toYear);
    return addBusinessDays(startDate, days, keys);
  }

  async countBusinessDaysBetween(
    gabineteId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const keys = await this.holidayKeysForRange(
      gabineteId,
      start.getUTCFullYear(),
      end.getUTCFullYear(),
    );
    return countBusinessDaysBetween(start, end, keys);
  }

  async rollForwardIfNonBusiness(
    gabineteId: string,
    d: Date,
  ): Promise<Date> {
    const keys = await this.holidayKeysForRange(
      gabineteId,
      d.getUTCFullYear(),
      d.getUTCFullYear() + 1,
    );
    return rollForwardIfNonBusiness(d, keys);
  }

  /**
   * Seeds system-wide Angolan holidays for the current & next two years.
   * Idempotent via unique (gabineteId, date, name).
   */
  async ensureSystemSeeded(): Promise<void> {
    const now = new Date();
    const years = [
      now.getUTCFullYear(),
      now.getUTCFullYear() + 1,
      now.getUTCFullYear() + 2,
    ];
    for (const y of years) {
      const existing = await this.prisma.holiday.count({
        where: {
          gabineteId: null,
          date: {
            gte: new Date(Date.UTC(y, 0, 1)),
            lt: new Date(Date.UTC(y + 1, 0, 1)),
          },
        },
      });
      if (existing > 0) continue;
      const list = getAngolanHolidays(y);
      for (const h of list) {
        await this.prisma.holiday
          .create({
            data: {
              gabineteId: null,
              name: h.name,
              date: h.date,
              kind: h.kind,
              recurring: h.recurring,
            },
          })
          .catch(() => {
            /* unique collision — fine */
          });
      }
    }
  }
}
