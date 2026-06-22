import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ComplianceEngine } from './engine/compliance.engine';

@Module({
  imports: [WebhooksModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceEngine],
  exports: [ComplianceService, ComplianceEngine],
})
export class ComplianceModule {}
