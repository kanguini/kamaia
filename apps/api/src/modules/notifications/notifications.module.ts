import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    EmailProvider,
    SmsProvider,
    PushProvider,
    AlertsSchedulerService,
  ],
  exports: [NotificationsService, EmailProvider, PushProvider],
})
export class NotificationsModule {}
