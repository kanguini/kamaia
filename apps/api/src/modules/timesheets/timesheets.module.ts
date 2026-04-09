import { Module } from '@nestjs/common';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsRepository } from './timesheets.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService, TimesheetsRepository],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
