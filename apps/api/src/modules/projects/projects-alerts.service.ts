import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import { PushProvider } from '../notifications/providers/push.provider';
import { NotificationType, KamaiaRole } from '@kamaia/shared-types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    private email: EmailProvider,
    private push: PushProvider,
    private config: ConfigService,
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
      select: {
        id: true,
        gabineteId: true,
        managerId: true,
        name: true,
        // Role é necessário para a assinatura do getBurndown — o manager
        // passa sempre o filtro de visibility (match em managerId), mas
        // precisamos fornecer um role válido ao contrato da service.
        manager: { select: { role: true } },
      },
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
    manager: { role: string };
  }): Promise<number> {
    const result = await this.projectsService.getBurndown(
      p.gabineteId,
      p.managerId,
      p.manager.role as KamaiaRole,
      p.id,
    );
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

    const subject = `Orçamento acima do previsto — ${p.name}`;
    const body = `O gasto real está ${(ratio * 100).toFixed(0)}% do ideal (limite 115%). Reveja o consumo antes que o projecto estoure o orçamento.`;

    const notification = await this.prisma.notification.create({
      data: {
        gabineteId: p.gabineteId,
        userId: p.managerId,
        type: NotificationType.PROJECT_BUDGET_DRIFT,
        channel: 'IN_APP',
        status: 'PENDING',
        subject,
        body,
        metadata: {
          projectId: p.id,
          ratio,
          actualSpent: point.actualSpent,
          idealSpent: point.idealSpent,
        },
      },
    });

    await this.deliver(p.managerId, notification.id, subject, body, `/projectos/${p.id}`);
    return 1;
  }

  private async checkOverdueMilestones(p: {
    id: string;
    gabineteId: string;
    managerId: string;
    name: string;
    manager: { role: string };
  }): Promise<number> {
    const now = new Date();
    const overdue = await this.prisma.projectMilestone.findMany({
      where: {
        projectId: p.id,
        deletedAt: null,
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
      const subject = `Marco atrasado — ${m.title}`;
      const body = `O marco "${m.title}" do projecto ${p.name} está atrasado há ${daysLate} dia(s). Ajuste a data ou feche-o quando concluído.`;

      const notif = await this.prisma.notification.create({
        data: {
          gabineteId: p.gabineteId,
          userId: p.managerId,
          type: NotificationType.PROJECT_MILESTONE_OVERDUE,
          channel: 'IN_APP',
          status: 'PENDING',
          subject,
          body,
          metadata: { projectId: p.id, milestoneId: m.id, daysLate },
        },
      });
      await this.deliver(
        p.managerId,
        notif.id,
        subject,
        body,
        `/projectos/${p.id}`,
      );
      created++;
    }
    return created;
  }

  /**
   * Fire-and-forget fan-out to email + push. In-app row is already persisted
   * upstream; here we update its status/sentAt based on delivery outcomes.
   * Failures are logged but never surfaced to the caller — notifications
   * degrade gracefully when providers are unconfigured (DRY_RUN).
   */
  private async deliver(
    userId: string,
    notificationId: string,
    subject: string,
    body: string,
    href: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          pushSubscriptions: {
            where: { isActive: true },
            select: { endpoint: true, p256dh: true, auth: true, id: true },
          },
        },
      });
      if (!user) return;

      const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
      const fullUrl = frontendUrl ? `${frontendUrl.split(',')[0].trim()}${href}` : href;

      // ── Email ────────────────────────────────────────
      const emailHtml = this.buildEmailHtml(subject, body, fullUrl, user.firstName);
      const emailRes = await this.email.send(user.email, subject, emailHtml);

      // ── Push (if subscribed) ─────────────────────────
      const pushResults = await Promise.all(
        user.pushSubscriptions.map((s) =>
          this.push.sendToSubscription(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            { title: subject, body, url: href },
          ),
        ),
      );

      // Prune expired push subs
      await Promise.all(
        pushResults.map(async (r, i) => {
          if (r.status === 'FAILED' && (r.metadata as any)?.expired) {
            await this.prisma.pushSubscription.update({
              where: { id: user.pushSubscriptions[i].id },
              data: { isActive: false },
            });
          }
        }),
      );

      const anySent =
        emailRes.status === 'SENT' || pushResults.some((r) => r.status === 'SENT');

      // Merge delivery info into existing metadata (don't clobber the dedupe
      // fields like projectId/milestoneId the scheduler uses).
      const existing = await this.prisma.notification.findUnique({
        where: { id: notificationId },
        select: { metadata: true },
      });
      const mergedMetadata = {
        ...((existing?.metadata as Record<string, unknown>) ?? {}),
        delivery: {
          email: emailRes.status,
          push: pushResults.map((r) => r.status),
        },
      };

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: anySent ? 'SENT' : emailRes.status === 'DRY_RUN' ? 'PENDING' : 'FAILED',
          sentAt: anySent ? new Date() : null,
          errorMessage: anySent ? null : emailRes.errorMessage ?? null,
          metadata: mergedMetadata as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Deliver fan-out failed for notification ${notificationId}: ${(err as Error).message}`,
      );
    }
  }

  private buildEmailHtml(
    subject: string,
    body: string,
    url: string,
    firstName: string | null,
  ): string {
    return `
<!doctype html>
<html><body style="font-family: -apple-system, Inter, sans-serif; color: #111; max-width: 520px; margin: 24px auto; padding: 24px;">
  <h2 style="margin: 0 0 12px;">${escapeHtml(subject)}</h2>
  <p style="color: #555; line-height: 1.5;">Olá${firstName ? ` ${escapeHtml(firstName)}` : ''},</p>
  <p style="line-height: 1.5;">${escapeHtml(body)}</p>
  <p>
    <a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;">Abrir no Kamaia</a>
  </p>
  <hr style="border:0;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#999;font-size:12px;">Recebes este email porque és gestor deste projecto no Kamaia. Ajusta preferências em Configurações → Notificações.</p>
</body></html>
    `.trim();
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
