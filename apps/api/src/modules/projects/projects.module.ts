import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsAlertsService } from './projects-alerts.service';
import { ProjectReportsService } from './project-reports.service';
import { CapacityService } from './capacity.service';
import { ProjectsController } from './projects.controller';
import { AuditModule } from '../audit/audit.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [AuditModule, WorkflowsModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsAlertsService,
    ProjectReportsService,
    CapacityService,
  ],
  exports: [
    ProjectsService,
    ProjectsAlertsService,
    ProjectReportsService,
    CapacityService,
  ],
})
export class ProjectsModule {}
