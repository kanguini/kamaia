import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ComplianceEngine } from './engine/compliance.engine';

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceEngine],
  exports: [ComplianceService, ComplianceEngine],
})
export class ComplianceModule {}
