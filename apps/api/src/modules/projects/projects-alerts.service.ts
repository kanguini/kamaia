import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { NotificationType } from '@kamaia/shared-types';

/**
 * Periodic job that scans active projects and spawns notifications when:
 *  - Actual spend exceeds the ideal burn-down by more than 15%
 *    (PROJECT_BUDGET_DRIFT)
 *  - A milestone's dueDate is past and it isn't completed yet
 *    (PROJECT_MILESTONE_OVERDUE)
 *
 * Idempotency is enforced by scanning for an existing notification of the
 * same type & project/milestone in the last 24 h before creating a new one.
 */
@Injectable()
export class ProjectsAlertsService {
  private readonly logger = new Logger(ProjectsAlertsService.name);
  private readonly DRIFT_THRESHOLD = 1.15; // 15% over curve
  private readonly DEDUPE_HOURS = 24;

  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyCheck() {
    this.logger.log('Running projects alerts check');
    await this.runOnce();
  }

  /**
   * Executes the full scan and returns a summary. Exposed as a method so we
   * can trigger it from tests and from a manual admin endpoint.
   */
  async runOnce(): Promise<{
    projectsScanned: number;
    driftAlerts: number;
    overdueAlerts: number;
  }> {
    const projects = await this.prisma.project.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVO', 'PROPOSTA'] } },
      select: { id: true, gabineteId: true, managerId: true, name: true },
    });

    let driftAlerts = 0;
    let overdueAlerts = 0;

    for (const p of projects) {
      driftAlerts += await this.checkBudgetDrift(p);
      overdueAlerts += await this.checkOverdueMilestones(p);
    }

    return { projectsScanned: projects.length, driftAlerts, overdueAlerts };
  }

  private async checkBudgetDrift(p: {
    id: string;
    gabineteId: string;
    managerId: string;
    name: string;
  }): Promise<number> {
    const result = await this.projectsService.getBurndown(p.gabineteId, p.id);
    if (!result.success) return 0;
    const burndown = result.data as {
      budget: number;
      series: { date: string; actualSpent: number; idealSpent: number }[];
    };
    if (!burndown.budget || burndown.series.length === 0) return 0;

    // Compute drift at "today" (or the last series point if today hasn't been
    // bucketed yet): if actual > ideal × threshold, raise an alert.
    const todayKey = new Date().toISOString().slice(0, 10);
    const point =
      burndown.series.find((s) => s.date === todayKey) ??
      burndown.series[burndown.series.length - 1];
    if (point.idealSpent === 0) return 0;
    const ratio = point.actualSpent / point.idealSpent;
    if (ratio < this.DRIFT_THRESHOLD) return 0;

    const deduped = await this.hasRecent(
      p.gabineteId,
      p.managerId,
      NotificationType.PROJECT_BUDGET_DRIFT,
      { projectId: p.id },
    );
    if (deduped) return 0;

    await this.prisma.notification.create({
      data: {
        gabineteId: p.gabineteId,
        userId: p.managerId,
        type: NotificationType.PROJECT_BUDGET_DRIFT,
        channel: 'IN_APP',
        status: 'PENDING',
        subject: `Orçamento acima do previsto — ${p.name}`,
        body: `O gasto real está ${(ratio * 100).toFixed(0)}% do ideal (limite 115%). Reveja o consumo antes que o projecto estoure o orçamento.`,
        metadata: {
          projectId: p.id,
          ratio,
          actualSpent: point.actualSpent,
          idealSpent: point.idealSpent,
        },
      },
    });
    return 1;
  }

  private async checkOverdueMilestones(p: {
    id: string;
    gabineteId: string;
    managerId: string;
    name: string;
  }): Promise<number> {
    const now = new Date();
    const overdue = await this.prisma.projectMilestone.findMany({
      where: {
        projectId: p.id,
        completedAt: null,
        dueDate: { lt: now },
      },
      select: { id: true, title: true, dueDate: true },
    });

    let created = 0;
    for (const m of overdue) {
      const deduped = await this.hasRecent(
        p.gabineteId,
        p.managerId,
        NotificationType.PROJECT_MILESTONE_OVERDUE,
        { milestoneId: m.id },
      );
      if (deduped) continue;

      const daysLate = Math.max(
        1,
        Math.floor((now.getTime() - m.dueDate.getTime()) / 86_400_000),
      );
      await this.prisma.notification.create({
        data: {
          gabineteId: p.gabineteId,
          userId: p.managerId,
          type: NotificationType.PROJECT_MILESTONE_OVERDUE,
          channel: 'IN_APP',
          status: 'PENDING',
          subject: `Marco atrasado — ${m.title}`,
          body: `O marco "${m.title}" do projecto ${p.name} está atrasado há ${daysLate} dia(s). Ajuste a data ou feche-o quando concluído.`,
          metadata: { projectId: p.id, milestoneId: m.id, daysLate },
        },
      });
      created++;
    }
    return created;
  }

  /**
   * Returns true when a notification of the same type was created for the
   * same metadata reference within the dedupe window.
   */
  private async hasRecent(
    gabineteId: string,
    userId: string,
    type: NotificationType,
    ref: { projectId?: string; milestoneId?: string },
  ): Promise<boolean> {
    const since = new Date(Date.now() - this.DEDUPE_HOURS * 3600_000);
    const where: Record<string, unknown> = {
      gabineteId,
      userId,
      type,
      createdAt: { gt: since },
    };
    // Prisma JSON filter — Postgres jsonb @> operator
    if (ref.projectId) {
      where.metadata = { path: ['projectId'], equals: ref.projectId };
    } else if (ref.milestoneId) {
      where.metadata = { path: ['milestoneId'], equals: ref.milestoneId };
    }
    const existing = await this.prisma.notification.findFirst({
      where: where as any,
      select: { id: true },
    });
    return !!existing;
  }
}
