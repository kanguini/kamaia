import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AlertsScheduler } from './alerts-scheduler.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [WebhooksModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AlertsScheduler],
  exports: [NotificationsService, AlertsScheduler],
})
export class NotificationsModule {}
