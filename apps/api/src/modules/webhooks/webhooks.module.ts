import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryWorker],
  exports: [WebhooksService],
})
export class WebhooksModule {}
