import { Module } from '@nestjs/common';
import { PublicContactsController } from './public-contacts.controller';
import { PublicContactsService } from './public-contacts.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PublicContactsController],
  providers: [PublicContactsService],
})
export class PublicContactsModule {}
