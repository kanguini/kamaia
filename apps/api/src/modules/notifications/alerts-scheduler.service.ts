import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationType } from '@kamaia/shared-types';

@Injectable()
export class AlertsSchedulerService {
  private readonly logger = new Logger(AlertsSchedulerService.name);

  constructor(
    private repo: NotificationsRepository,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledAlertsJob() {
    this.logger.log('Running scheduled alerts job');
    return this.runAlertsJob();
  }

  async runAlertsJob(): Promise<{
    gabinetes: number;
    prazos: number;
    notifications: number;
  }> {
    const gabinetes = await this.repo.getAllActiveGabinetes();
    let totalPrazos = 0;
    let totalNotifications = 0;

    for (const gab of gabinetes) {
      const prazos = await this.repo.getPrazosNeedingAlerts(gab.id);
      totalPrazos += prazos.length;

      for (const prazo of prazos) {
        const advogadoId = prazo.processo.advogadoId;
        if (!advogadoId) continue;

        // Determine type based on time until dueDate
        const hoursUntil =
          (new Date(prazo.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
        let type: NotificationType;
        if (prazo.isUrgent) {
          type = NotificationType.PRAZO_CRITICAL;
        } else if (hoursUntil <= 24) {
          type = NotificationType.PRAZO_TODAY;
        } else {
          type = NotificationType.PRAZO_UPCOMING;
        }

        const result = await this.notificationsService.sendPrazoAlert(
          gab.id,
          advogadoId,
          prazo,
          type,
        );
        if (result.success) totalNotifications++;
      }
    }

    this.logger.log(
      `Alerts job complete: ${gabinetes.length} gabinetes, ${totalPrazos} prazos, ${totalNotifications} notifications sent`,
    );
    return {
      gabinetes: gabinetes.length,
      prazos: totalPrazos,
      notifications: totalNotifications,
    };
  }
}
