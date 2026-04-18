import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PROCESSO_STAGE_TEMPLATES,
  PROJECT_STAGE_TEMPLATES,
  StageTemplate,
} from '@kamaia/shared-types';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  UpsertStageDto,
  ReorderStagesDto,
  ListWorkflowsDto,
} from './workflows.dto';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async list(gabineteId: string, params: ListWorkflowsDto): Promise<Result<any[]>> {
    try {
      const workflows = await this.prisma.workflow.findMany({
        where: {
          gabineteId,
          ...(params.scope && { scope: params.scope }),
          ...(params.appliesTo && { appliesTo: { has: params.appliesTo } }),
          ...(!params.includeArchived && { isArchived: false }),
        },
        include: {
          stages: { orderBy: { position: 'asc' } },
          _count: { select: { processos: true, projects: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
      return ok(workflows);
    } catch (e) {
      return err('Failed to list workflows', 'WORKFLOWS_LIST_FAILED');
    }
  }

  async findById(gabineteId: string, id: string): Promise<Result<any>> {
    try {
      const wf = await this.prisma.workflow.findFirst({
        where: { id, gabineteId },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
      if (!wf) return err('Workflow not found', 'WORKFLOW_NOT_FOUND');
      return ok(wf);
    } catch (e) {
      return err('Failed to fetch workflow', 'WORKFLOW_FETCH_FAILED');
    }
  }

  async create(gabineteId: string, dto: CreateWorkflowDto): Promise<Result<any>> {
    try {
      // Ensure stage keys are unique within the workflow
      const keys = new Set(dto.stages.map((s) => s.key));
      if (keys.size !== dto.stages.length) {
        return err('Duplicate stage keys in workflow', 'DUPLICATE_STAGE_KEY');
      }

      const wf = await this.prisma.workflow.create({
        data: {
          gabineteId,
          name: dto.name,
          description: dto.description,
          scope: dto.scope,
          appliesTo: dto.appliesTo,
          isDefault: dto.isDefault ?? false,
          stages: {
            create: dto.stages.map((s, i) => ({
              key: s.key,
              label: s.label,
              position: s.position ?? i,
              color: s.color ?? null,
              category: s.category ?? null,
              slaHours: s.slaHours ?? null,
              allowsParallel: s.allowsParallel ?? false,
              isTerminal: s.isTerminal ?? false,
            })),
          },
        },
        include: { stages: { orderBy: { position: 'asc' } } },
      });

      // If marked default, unset any other defaults with overlapping scope+appliesTo
      if (dto.isDefault) await this.ensureSingleDefault(gabineteId, wf.id, wf.scope);

      return ok(wf);
    } catch (e) {
      return err('Failed to create workflow', 'WORKFLOW_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    id: string,
    dto: UpdateWorkflowDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prisma.workflow.findFirst({ where: { id, gabineteId } });
      if (!existing) return err('Workflow not found', 'WORKFLOW_NOT_FOUND');

      const updated = await this.prisma.workflow.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.appliesTo !== undefined && { appliesTo: dto.appliesTo }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
        },
        include: { stages: { orderBy: { position: 'asc' } } },
      });

      if (dto.isDefault) await this.ensureSingleDefault(gabineteId, id, existing.scope);

      return ok(updated);
    } catch (e) {
      return err('Failed to update workflow', 'WORKFLOW_UPDATE_FAILED');
    }
  }

  async delete(gabineteId: string, id: string): Promise<Result<void>> {
    try {
      const wf = await this.prisma.workflow.findFirst({
        where: { id, gabineteId },
        include: { _count: { select: { processos: true, projects: true } } },
      });
      if (!wf) return err('Workflow not found', 'WORKFLOW_NOT_FOUND');
      if (wf._count.processos > 0 || wf._count.projects > 0) {
        return err(
          'Workflow in use — archive it instead',
          'WORKFLOW_IN_USE',
        );
      }
      await this.prisma.workflow.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err('Failed to delete workflow', 'WORKFLOW_DELETE_FAILED');
    }
  }

  async addStage(
    gabineteId: string,
    workflowId: string,
    dto: UpsertStageDto,
  ): Promise<Result<any>> {
    try {
      const wf = await this.prisma.workflow.findFirst({
        where: { id: workflowId, gabineteId },
        include: { stages: true },
      });
      if (!wf) return err('Workflow not found', 'WORKFLOW_NOT_FOUND');

      const exists = wf.stages.find((s) => s.key === dto.key);
      if (exists) return err('Stage key already exists', 'DUPLICATE_STAGE_KEY');

      const maxPos = wf.stages.reduce((m, s) => Math.max(m, s.position), -1);
      const stage = await this.prisma.workflowStage.create({
        data: {
          workflowId,
          key: dto.key,
          label: dto.label,
          position: dto.position ?? maxPos + 1,
          color: dto.color ?? null,
          category: dto.category ?? null,
          slaHours: dto.slaHours ?? null,
          allowsParallel: dto.allowsParallel ?? false,
          isTerminal: dto.isTerminal ?? false,
        },
      });
      return ok(stage);
    } catch (e) {
      return err('Failed to add stage', 'STAGE_ADD_FAILED');
    }
  }

  async updateStage(
    gabineteId: string,
    stageId: string,
    dto: Partial<UpsertStageDto>,
  ): Promise<Result<any>> {
    try {
      const stage = await this.prisma.workflowStage.findFirst({
        where: { id: stageId, workflow: { gabineteId } },
      });
      if (!stage) return err('Stage not found', 'STAGE_NOT_FOUND');

      const updated = await this.prisma.workflowStage.update({
        where: { id: stageId },
        data: {
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.key !== undefined && { key: dto.key }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.slaHours !== undefined && { slaHours: dto.slaHours }),
          ...(dto.allowsParallel !== undefined && { allowsParallel: dto.allowsParallel }),
          ...(dto.isTerminal !== undefined && { isTerminal: dto.isTerminal }),
        },
      });
      return ok(updated);
    } catch (e) {
      return err('Failed to update stage', 'STAGE_UPDATE_FAILED');
    }
  }

  async deleteStage(gabineteId: string, stageId: string): Promise<Result<void>> {
    try {
      const stage = await this.prisma.workflowStage.findFirst({
        where: { id: stageId, workflow: { gabineteId } },
        include: { _count: { select: { instances: true } } },
      });
      if (!stage) return err('Stage not found', 'STAGE_NOT_FOUND');
      if (stage._count.instances > 0) {
        return err('Stage has processo instances — move them first', 'STAGE_IN_USE');
      }
      await this.prisma.workflowStage.delete({ where: { id: stageId } });
      return ok(undefined);
    } catch (e) {
      return err('Failed to delete stage', 'STAGE_DELETE_FAILED');
    }
  }

  async reorderStages(
    gabineteId: string,
    workflowId: string,
    dto: ReorderStagesDto,
  ): Promise<Result<any>> {
    try {
      const wf = await this.prisma.workflow.findFirst({
        where: { id: workflowId, gabineteId },
        include: { stages: true },
      });
      if (!wf) return err('Workflow not found', 'WORKFLOW_NOT_FOUND');

      const stageIds = new Set(wf.stages.map((s) => s.id));
      if (dto.stageIds.some((id) => !stageIds.has(id))) {
        return err('Invalid stage id in reorder list', 'INVALID_STAGE');
      }

      await this.prisma.$transaction(
        dto.stageIds.map((id, idx) =>
          this.prisma.workflowStage.update({
            where: { id },
            data: { position: idx },
          }),
        ),
      );

      return this.findById(gabineteId, workflowId);
    } catch (e) {
      return err('Failed to reorder stages', 'STAGE_REORDER_FAILED');
    }
  }

  /**
   * Seeds all default workflows for a gabinete. Safe to call multiple times —
   * only creates workflows that don't yet exist. Called on first list() when
   * the gabinete has no workflows.
   */
  async seedDefaults(gabineteId: string): Promise<Result<{ created: number }>> {
    try {
      const existing = await this.prisma.workflow.count({ where: { gabineteId } });
      if (existing > 0) return ok({ created: 0 });

      let created = 0;
      for (const [type, stages] of Object.entries(PROCESSO_STAGE_TEMPLATES)) {
        await this.createFromTemplate(gabineteId, 'PROCESSO', type, type, stages, true);
        created++;
      }
      for (const [cat, stages] of Object.entries(PROJECT_STAGE_TEMPLATES)) {
        await this.createFromTemplate(gabineteId, 'PROJECT', cat, cat, stages, true);
        created++;
      }
      return ok({ created });
    } catch (e) {
      return err('Failed to seed default workflows', 'WORKFLOW_SEED_FAILED');
    }
  }

  private async createFromTemplate(
    gabineteId: string,
    scope: 'PROCESSO' | 'PROJECT',
    name: string,
    appliesToToken: string,
    stages: StageTemplate[],
    isDefault: boolean,
  ): Promise<void> {
    await this.prisma.workflow.create({
      data: {
        gabineteId,
        name,
        scope,
        appliesTo: [appliesToToken],
        isDefault,
        stages: {
          create: stages.map((s, i) => ({
            key: s.key,
            label: s.label,
            position: i,
            category: s.category ?? null,
            allowsParallel: s.allowsParallel ?? false,
            isTerminal: s.isTerminal ?? false,
          })),
        },
      },
    });
  }

  /**
   * Finds the default workflow for a given scope + appliesTo token
   * (e.g. scope='PROCESSO', token='CIVEL'). Falls back to seeding.
   */
  async getDefaultFor(
    gabineteId: string,
    scope: 'PROCESSO' | 'PROJECT',
    appliesToToken: string,
  ): Promise<any | null> {
    await this.ensureSeeded(gabineteId);
    return this.prisma.workflow.findFirst({
      where: {
        gabineteId,
        scope,
        isDefault: true,
        isArchived: false,
        appliesTo: { has: appliesToToken },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  private async ensureSeeded(gabineteId: string): Promise<void> {
    const count = await this.prisma.workflow.count({ where: { gabineteId } });
    if (count === 0) await this.seedDefaults(gabineteId);
  }

  private async ensureSingleDefault(
    gabineteId: string,
    workflowId: string,
    scope: string,
  ): Promise<void> {
    await this.prisma.workflow.updateMany({
      where: {
        gabineteId,
        scope,
        isDefault: true,
        NOT: { id: workflowId },
      },
      data: { isDefault: false },
    });
  }
}
