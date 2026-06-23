import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AlertsScheduler } from './alerts-scheduler.service';
import { NotificationDeliveryWorker } from './notification-delivery.worker';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [WebhooksModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AlertsScheduler, NotificationDeliveryWorker],
  exports: [NotificationsService, AlertsScheduler],
})
export class NotificationsModule {}
