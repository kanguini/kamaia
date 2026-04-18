import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Result, ok, err } from '@kamaia/shared-types';

/**
 * Capacity heatmap — crosses `ProjectMember.allocationPct` (intended) with
 * `TimeEntry` (actual logged hours) to highlight over/under-utilised team
 * members across a week grid.
 *
 * Planned hours per week for a user = sum over their active projects of
 *   allocationPct × STANDARD_WEEK_HOURS / 100
 *
 * Actual hours per week = sum of time entry durations on processos
 *   belonging to projects the user is a member of, in the given week.
 *
 * Utilisation = actual / planned. 1.0 = on plan, >1 = over-utilised.
 */
@Injectable()
export class CapacityService {
  private readonly STANDARD_WEEK_HOURS = 40;

  constructor(private prisma: PrismaService) {}

  async getCapacity(
    gabineteId: string,
    weekStartIso?: string,
    weeks = 8,
  ): Promise<Result<any>> {
    try {
      const weekStart = this.mondayOfWeek(
        weekStartIso ? new Date(weekStartIso) : new Date(),
      );
      const rangeStart = weekStart;
      const rangeEnd = new Date(rangeStart.getTime() + weeks * 7 * 86_400_000);

      // Users in the gabinete
      const users = await this.prisma.user.findMany({
        where: { gabineteId, isActive: true, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        orderBy: { firstName: 'asc' },
      });

      // Active project memberships with allocation
      const memberships = await this.prisma.projectMember.findMany({
        where: {
          project: {
            gabineteId,
            deletedAt: null,
            status: { in: ['ACTIVO', 'PROPOSTA'] },
          },
        },
        select: {
          userId: true,
          allocationPct: true,
          project: { select: { id: true } },
        },
      });

      // Sum planned per user (projects contribute independently; if a user
      // is on 3 projects at 30% each → 90% plan).
      const plannedPctByUser = new Map<string, number>();
      const projectIdsByUser = new Map<string, Set<string>>();
      for (const m of memberships) {
        plannedPctByUser.set(
          m.userId,
          (plannedPctByUser.get(m.userId) ?? 0) + (m.allocationPct ?? 0),
        );
        const s = projectIdsByUser.get(m.userId) ?? new Set<string>();
        s.add(m.project.id);
        projectIdsByUser.set(m.userId, s);
      }

      // Pull all time entries in the range for the gabinete
      const entries = await this.prisma.timeEntry.findMany({
        where: {
          gabineteId,
          date: { gte: rangeStart, lt: rangeEnd },
        },
        select: { userId: true, date: true, durationMinutes: true },
      });

      // Bucket actual minutes by (userId, weekIndex)
      const actualByUserWeek = new Map<string, Map<number, number>>();
      for (const e of entries) {
        const idx = Math.floor(
          (new Date(e.date).getTime() - rangeStart.getTime()) /
            (7 * 86_400_000),
        );
        if (idx < 0 || idx >= weeks) continue;
        const byWeek = actualByUserWeek.get(e.userId) ?? new Map<number, number>();
        byWeek.set(idx, (byWeek.get(idx) ?? 0) + e.durationMinutes);
        actualByUserWeek.set(e.userId, byWeek);
      }

      // Build the grid: users × weeks
      const grid = users.map((u) => {
        const plannedPct = plannedPctByUser.get(u.id) ?? 0;
        const plannedMinutes = Math.round(
          (plannedPct / 100) * this.STANDARD_WEEK_HOURS * 60,
        );
        const perWeek = Array.from({ length: weeks }, (_, i) => {
          const weekStartDate = new Date(
            rangeStart.getTime() + i * 7 * 86_400_000,
          );
          const actual = actualByUserWeek.get(u.id)?.get(i) ?? 0;
          const utilization =
            plannedMinutes > 0 ? actual / plannedMinutes : 0;
          return {
            weekStart: weekStartDate.toISOString().slice(0, 10),
            plannedMinutes,
            actualMinutes: actual,
            utilization,
          };
        });
        return {
          user: u,
          plannedPct,
          weeks: perWeek,
        };
      });

      return ok({
        weekStart: rangeStart.toISOString().slice(0, 10),
        weeks,
        grid,
      });
    } catch (e) {
      return err('Failed to compute capacity', 'CAPACITY_FAILED');
    }
  }

  private mondayOfWeek(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    const day = x.getUTCDay();
    const delta = (day + 6) % 7;
    x.setUTCDate(x.getUTCDate() - delta);
    return x;
  }
}
