import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsAlertsService } from './projects-alerts.service';
import { ProjectsController } from './projects.controller';
import { AuditModule } from '../audit/audit.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [AuditModule, WorkflowsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsAlertsService],
  exports: [ProjectsService, ProjectsAlertsService],
})
export class ProjectsModule {}
