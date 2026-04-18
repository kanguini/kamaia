import { Injectable } from '@nestjs/common';
import { ProcessosRepository, ListProcessosParams } from './processos.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  PLAN_LIMITS,
  PROCESSO_STAGES,
  ProcessoType,
  ProcessoStatus,
  ProcessoEventType,
  KamaiaRole,
  LIFECYCLE_STAGES,
} from '@kamaia/shared-types';
import {
  CreateProcessoDto,
  UpdateProcessoDto,
  ChangeStageDto,
  ChangeStatusDto,
  CreateEventDto,
} from './processos.dto';

@Injectable()
export class ProcessosService {
  constructor(
    private processosRepository: ProcessosRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
    private workflows: WorkflowsService,
  ) {}

  async findAll(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    params: ListProcessosParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      // If ADVOGADO_MEMBRO, filter by advogadoId
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        params.advogadoId = userId;
      }

      const result = await this.processosRepository.findAll(gabineteId, params);
      return ok(result);
    } catch (error) {
      return err('Failed to fetch processos', 'PROCESSOS_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const processo = await this.processosRepository.findById(gabineteId, id);

      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // If ADVOGADO_MEMBRO, check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO && processo.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      return ok(processo);
    } catch (error) {
      return err('Failed to fetch processo', 'PROCESSO_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateProcessoDto,
  ): Promise<Result<any>> {
    try {
      // Check quota
      const gabinete = await this.prisma.gabinete.findUnique({
        where: { id: gabineteId },
        select: { plan: true },
      });

      if (!gabinete) {
        return err('Gabinete not found', 'GABINETE_NOT_FOUND');
      }

      const currentCount = await this.processosRepository.countByGabinete(gabineteId);
      const limit = PLAN_LIMITS[gabinete.plan as keyof typeof PLAN_LIMITS].processos;

      if (limit !== -1 && currentCount >= limit) {
        return err('Processo quota exceeded for current plan', 'QUOTA_EXCEEDED');
      }

      // Generate processo number
      const processoNumber = await this.processosRepository.getNextNumber(gabineteId);

      // Resolve the default workflow for this processo type (seeds workflows
      // the first time they're needed). Falls back to the legacy constant.
      const workflow = await this.workflows.getDefaultFor(gabineteId, 'PROCESSO', dto.type);
      const firstStage = workflow?.stages?.[0];
      const initialStageLabel =
        firstStage?.label ?? PROCESSO_STAGES[dto.type][0];

      // Create processo
      const processo = await this.processosRepository.create(gabineteId, {
        ...dto,
        processoNumber,
        advogadoId: userId,
        stage: initialStageLabel,
      });

      // Attach workflow and create the initial stage instance (parallel-ready)
      if (workflow?.id && firstStage?.id) {
        await this.prisma.processo.update({
          where: { id: processo.id },
          data: { workflowId: workflow.id },
        });
        await this.prisma.processoStageInstance.create({
          data: {
            processoId: processo.id,
            stageId: firstStage.id,
            status: 'EM_CURSO',
            enteredAt: new Date(),
          },
        });
      }

      // Create initial stage change event
      await this.processosRepository.createEvent(processo.id, userId, {
        type: ProcessoEventType.STAGE_CHANGE,
        description: `Processo criado na fase: ${initialStageLabel}`,
        metadata: { stage: initialStageLabel },
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.PROCESSO,
        entityId: processo.id,
        userId,
        gabineteId,
        newValue: {
          processoNumber: processo.processoNumber,
          title: processo.title,
          type: processo.type,
        },
      });

      return ok(processo);
    } catch (error) {
      return err('Failed to create processo', 'PROCESSO_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateProcessoDto,
  ): Promise<Result<any>> {
    try {
      // Check processo exists
      const existing = await this.processosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const processo = await this.processosRepository.update(gabineteId, id, dto);
      if (!processo) {
        return err('Processo not found after update', 'PROCESSO_NOT_FOUND');
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
        newValue: { title: processo.title },
      });

      return ok(processo);
    } catch (error) {
      return err('Failed to update processo', 'PROCESSO_UPDATE_FAILED');
    }
  }

  async changeStage(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: ChangeStageDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.processosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Validate stage for processo type
      const validStages = PROCESSO_STAGES[existing.type as ProcessoType];
      if (!validStages.includes(dto.stage)) {
        return err('Invalid stage for this processo type', 'INVALID_STAGE');
      }

      const processo = await this.processosRepository.changeStage(gabineteId, id, dto.stage);
      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      await this.processosRepository.createEvent(processo.id, userId, {
        type: ProcessoEventType.STAGE_CHANGE,
        description: `Fase alterada de "${existing.stage}" para "${dto.stage}"`,
        metadata: { oldStage: existing.stage, newStage: dto.stage },
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { stage: existing.stage },
        newValue: { stage: dto.stage },
      });

      return ok(processo);
    } catch (error) {
      return err('Failed to change stage', 'STAGE_CHANGE_FAILED');
    }
  }

  async changeStatus(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: ChangeStatusDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.processosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const closedAt =
        dto.status === ProcessoStatus.ENCERRADO ? new Date() : undefined;

      const processo = await this.processosRepository.changeStatus(
        gabineteId,
        id,
        dto.status,
        closedAt,
      );
      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      await this.processosRepository.createEvent(processo.id, userId, {
        type: ProcessoEventType.STATUS_CHANGE,
        description: `Status alterado de "${existing.status}" para "${dto.status}"`,
        metadata: { oldStatus: existing.status, newStatus: dto.status },
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { status: existing.status },
        newValue: { status: dto.status },
      });

      return ok(processo);
    } catch (error) {
      return err('Failed to change status', 'STATUS_CHANGE_FAILED');
    }
  }

  async delete(gabineteId: string, userId: string, id: string): Promise<Result<void>> {
    try {
      const existing = await this.processosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      await this.processosRepository.softDelete(gabineteId, id);

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { processoNumber: existing.processoNumber, title: existing.title },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete processo', 'PROCESSO_DELETE_FAILED');
    }
  }

  async getEvents(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    processoId: string,
    cursor?: string,
    limit?: number,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const processo = await this.processosRepository.findById(gabineteId, processoId);
      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO && processo.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const result = await this.processosRepository.findEvents(
        processoId,
        cursor,
        limit || 20,
      );
      return ok(result);
    } catch (error) {
      return err('Failed to fetch events', 'EVENTS_FETCH_FAILED');
    }
  }

  async addEvent(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    processoId: string,
    dto: CreateEventDto,
  ): Promise<Result<any>> {
    try {
      const processo = await this.processosRepository.findById(gabineteId, processoId);
      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Check ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO && processo.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const event = await this.processosRepository.createEvent(processoId, userId, dto);

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.PROCESSO,
        entityId: processoId,
        userId,
        gabineteId,
        newValue: { eventType: dto.type, description: dto.description },
      });

      return ok(event);
    } catch (error) {
      return err('Failed to add event', 'EVENT_CREATE_FAILED');
    }
  }

  // ── Kanban ─────────────────────────────────────────────

  async findForKanban(
    gabineteId: string,
    type?: string,
    advogadoId?: string,
  ): Promise<Result<any>> {
    try {
      const processos = await this.processosRepository.findForKanban(
        gabineteId,
        type,
        advogadoId,
      );

      // Group by stage
      const grouped: Record<string, any[]> = {};
      for (const p of processos) {
        const stage = p.stage || 'Sem Fase';
        if (!grouped[stage]) grouped[stage] = [];
        grouped[stage].push(p);
      }

      return ok(grouped);
    } catch (error) {
      return err('Failed to load kanban', 'KANBAN_FAILED');
    }
  }

  // ── Pipeline ───────────────────────────────────────────

  async getPipelineCounts(
    gabineteId: string,
  ): Promise<Result<Record<string, number>>> {
    try {
      const groups = await this.processosRepository.findPipelineCounts(gabineteId);
      const counts: Record<string, number> = {};
      for (const stage of LIFECYCLE_STAGES) {
        counts[stage] = 0;
      }
      for (const g of groups) {
        counts[g.lifecycle] = g._count.id;
      }
      return ok(counts);
    } catch (error) {
      return err('Failed to get pipeline', 'PIPELINE_FAILED');
    }
  }

  // ── Lifecycle ──────────────────────────────────────────

  async changeLifecycle(
    gabineteId: string,
    userId: string,
    userRole: string,
    processoId: string,
    lifecycle: string,
  ): Promise<Result<any>> {
    try {
      if (!LIFECYCLE_STAGES.includes(lifecycle as any)) {
        return err('Fase do ciclo de vida invalida', 'INVALID_LIFECYCLE');
      }

      const existing = await this.processosRepository.findById(gabineteId, processoId);
      if (!existing) return err('Processo nao encontrado', 'PROCESSO_NOT_FOUND');

      if (userRole === KamaiaRole.ADVOGADO_MEMBRO && existing.advogadoId !== userId) {
        return err('Sem permissao', 'ACCESS_DENIED');
      }

      const updated = await this.processosRepository.changeLifecycle(
        gabineteId,
        processoId,
        lifecycle,
      );

      await this.prisma.processoEvent.create({
        data: {
          processoId,
          userId,
          type: 'STAGE_CHANGE',
          description: `Ciclo de vida: ${existing.lifecycle || 'N/A'} → ${lifecycle}`,
          metadata: { oldLifecycle: existing.lifecycle, newLifecycle: lifecycle },
        },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to change lifecycle', 'LIFECYCLE_CHANGE_FAILED');
    }
  }

  // ── Tags ───────────────────────────────────────────────

  async getAllTags(gabineteId: string): Promise<Result<string[]>> {
    try {
      const tags = await this.processosRepository.findAllTags(gabineteId);
      return ok(tags);
    } catch (error) {
      return err('Failed to get tags', 'TAGS_FAILED');
    }
  }

  // ─────────────────────────────────────────────────────────
  // Dynamic stage instances (parallel support)
  //
  // A processo can be in multiple stages at once — e.g. "Réplica" (articulado)
  // and "Incidente" (paralelo) — by creating one ProcessoStageInstance per
  // active stage. `enterStage` creates an instance, `exitStage` closes it.
  // ─────────────────────────────────────────────────────────

  async listStageInstances(gabineteId: string, processoId: string): Promise<Result<any[]>> {
    try {
      const processo = await this.processosRepository.findById(gabineteId, processoId);
      if (!processo) return err('Processo not found', 'PROCESSO_NOT_FOUND');
      const instances = await this.prisma.processoStageInstance.findMany({
        where: { processoId },
        include: { stage: true },
        orderBy: { enteredAt: 'desc' },
      });
      return ok(instances);
    } catch (e) {
      return err('Failed to list stage instances', 'STAGE_INSTANCES_FAILED');
    }
  }

  async enterStage(
    gabineteId: string,
    userId: string,
    processoId: string,
    stageId: string,
  ): Promise<Result<any>> {
    try {
      const processo = await this.processosRepository.findById(gabineteId, processoId);
      if (!processo) return err('Processo not found', 'PROCESSO_NOT_FOUND');

      const stage = await this.prisma.workflowStage.findFirst({
        where: { id: stageId, workflow: { gabineteId } },
      });
      if (!stage) return err('Stage not found', 'STAGE_NOT_FOUND');

      // If the stage is non-parallel, close any other EM_CURSO instances first
      if (!stage.allowsParallel) {
        await this.prisma.processoStageInstance.updateMany({
          where: { processoId, status: 'EM_CURSO' },
          data: { status: 'CUMPRIDO', exitedAt: new Date() },
        });
      }

      const instance = await this.prisma.processoStageInstance.create({
        data: {
          processoId,
          stageId,
          status: 'EM_CURSO',
          enteredAt: new Date(),
        },
        include: { stage: true },
      });

      // Keep legacy `stage` column for back-compat (shows last non-parallel stage)
      if (!stage.allowsParallel) {
        await this.prisma.processo.update({
          where: { id: processoId },
          data: { stage: stage.label },
        });
      }

      await this.processosRepository.createEvent(processoId, userId, {
        type: ProcessoEventType.STAGE_CHANGE,
        description: `Entrou na fase: ${stage.label}`,
        metadata: { stageId, key: stage.key, parallel: stage.allowsParallel },
      });

      return ok(instance);
    } catch (e) {
      return err('Failed to enter stage', 'STAGE_ENTER_FAILED');
    }
  }

  async exitStage(
    gabineteId: string,
    userId: string,
    processoId: string,
    instanceId: string,
    status: 'CUMPRIDO' | 'SKIPPED' = 'CUMPRIDO',
  ): Promise<Result<any>> {
    try {
      const processo = await this.processosRepository.findById(gabineteId, processoId);
      if (!processo) return err('Processo not found', 'PROCESSO_NOT_FOUND');

      const instance = await this.prisma.processoStageInstance.findFirst({
        where: { id: instanceId, processoId },
        include: { stage: true },
      });
      if (!instance) return err('Stage instance not found', 'INSTANCE_NOT_FOUND');

      const updated = await this.prisma.processoStageInstance.update({
        where: { id: instanceId },
        data: { status, exitedAt: new Date() },
        include: { stage: true },
      });

      await this.processosRepository.createEvent(processoId, userId, {
        type: ProcessoEventType.STAGE_CHANGE,
        description: `Saiu da fase: ${instance.stage.label} (${status})`,
        metadata: { stageId: instance.stageId, status },
      });

      return ok(updated);
    } catch (e) {
      return err('Failed to exit stage', 'STAGE_EXIT_FAILED');
    }
  }
}
