import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowsService } from '../workflows/workflows.service';
import {
  Result,
  ok,
  err,
  AuditAction,
  EntityType,
} from '@kamaia/shared-types';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
  AddMemberDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private workflows: WorkflowsService,
  ) {}

  async list(gabineteId: string, params: ListProjectsDto): Promise<Result<any>> {
    try {
      const where: any = { gabineteId, deletedAt: null };
      if (params.status) where.status = params.status;
      if (params.category) where.category = params.category;
      if (params.managerId) where.managerId = params.managerId;
      if (params.clienteId) where.clienteId = params.clienteId;
      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: 'insensitive' } },
          { code: { contains: params.search, mode: 'insensitive' } },
        ];
      }

      const projects = await this.prisma.project.findMany({
        where,
        take: params.limit + 1,
        ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
        orderBy: { updatedAt: 'desc' },
        include: {
          cliente: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          workflow: { select: { id: true, name: true } },
          _count: { select: { processos: true, milestones: true, members: true } },
        },
      });

      const hasMore = projects.length > params.limit;
      const data = hasMore ? projects.slice(0, -1) : projects;
      const nextCursor = hasMore ? data[data.length - 1].id : null;

      return ok({ data, total: data.length, nextCursor });
    } catch (e) {
      return err('Failed to list projects', 'PROJECTS_LIST_FAILED');
    }
  }

  async findById(gabineteId: string, id: string): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id, gabineteId, deletedAt: null },
        include: {
          cliente: { select: { id: true, name: true, type: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          sponsor: { select: { id: true, firstName: true, lastName: true } },
          workflow: { include: { stages: { orderBy: { position: 'asc' } } } },
          members: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true, role: true },
              },
            },
          },
          milestones: { orderBy: { position: 'asc' } },
          processos: {
            select: { id: true, title: true, processoNumber: true, status: true, stage: true },
            take: 50,
          },
        },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');
      return ok(project);
    } catch (e) {
      return err('Failed to fetch project', 'PROJECT_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateProjectDto,
  ): Promise<Result<any>> {
    try {
      const code = dto.code ?? (await this.nextCode(gabineteId, dto.category));

      const duplicate = await this.prisma.project.findFirst({
        where: { gabineteId, code },
      });
      if (duplicate) return err('Project code already exists', 'PROJECT_CODE_EXISTS');

      // Auto-attach default workflow if none specified
      let workflowId = dto.workflowId ?? null;
      if (!workflowId) {
        const defaultWf = await this.workflows.getDefaultFor(
          gabineteId,
          'PROJECT',
          dto.category,
        );
        workflowId = defaultWf?.id ?? null;
      }

      const project = await this.prisma.project.create({
        data: {
          gabineteId,
          code,
          name: dto.name,
          category: dto.category,
          clienteId: dto.clienteId ?? null,
          managerId: dto.managerId ?? userId,
          sponsorId: dto.sponsorId ?? null,
          workflowId,
          status: dto.status ?? 'ACTIVO',
          healthStatus: dto.healthStatus ?? 'GREEN',
          scope: dto.scope ?? null,
          objectives: dto.objectives ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          budgetAmount: dto.budgetAmount ?? null,
          budgetCurrency: dto.budgetCurrency ?? 'AKZ',
          tags: dto.tags ?? [],
        },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Manager is automatically an ACCOUNTABLE member
      await this.prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: project.managerId,
          role: 'ACCOUNTABLE',
        },
      });

      await this.audit.log({
        action: AuditAction.CREATE,
        entity: EntityType.PROCESSO, // reuse existing enum; a dedicated PROJECT entity can be added later
        entityId: project.id,
        userId,
        gabineteId,
        newValue: { kind: 'project', code, category: dto.category },
      });

      return ok(project);
    } catch (e) {
      return err('Failed to create project', 'PROJECT_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    id: string,
    dto: UpdateProjectDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prisma.project.findFirst({
        where: { id, gabineteId, deletedAt: null },
      });
      if (!existing) return err('Project not found', 'PROJECT_NOT_FOUND');

      const updated = await this.prisma.project.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.clienteId !== undefined && { clienteId: dto.clienteId }),
          ...(dto.managerId !== undefined && { managerId: dto.managerId }),
          ...(dto.sponsorId !== undefined && { sponsorId: dto.sponsorId }),
          ...(dto.workflowId !== undefined && { workflowId: dto.workflowId }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.healthStatus !== undefined && { healthStatus: dto.healthStatus }),
          ...(dto.scope !== undefined && { scope: dto.scope }),
          ...(dto.objectives !== undefined && { objectives: dto.objectives }),
          ...(dto.startDate !== undefined && {
            startDate: dto.startDate ? new Date(dto.startDate) : null,
          }),
          ...(dto.endDate !== undefined && {
            endDate: dto.endDate ? new Date(dto.endDate) : null,
          }),
          ...(dto.actualEndDate !== undefined && {
            actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : null,
          }),
          ...(dto.budgetAmount !== undefined && { budgetAmount: dto.budgetAmount }),
          ...(dto.budgetCurrency !== undefined && { budgetCurrency: dto.budgetCurrency }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.risksJson !== undefined && { risksJson: dto.risksJson as any }),
        },
      });

      await this.audit.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        newValue: { kind: 'project' },
      });

      return ok(updated);
    } catch (e) {
      return err('Failed to update project', 'PROJECT_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.prisma.project.findFirst({
        where: { id, gabineteId, deletedAt: null },
      });
      if (!existing) return err('Project not found', 'PROJECT_NOT_FOUND');

      await this.prisma.project.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'CANCELADO' },
      });

      await this.audit.log({
        action: AuditAction.DELETE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        newValue: { kind: 'project' },
      });

      return ok(undefined);
    } catch (e) {
      return err('Failed to delete project', 'PROJECT_DELETE_FAILED');
    }
  }

  // ── Members ──────────────────────────────────────────
  async addMember(
    gabineteId: string,
    projectId: string,
    dto: AddMemberDto,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId, deletedAt: null },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const member = await this.prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: dto.userId } },
        create: {
          projectId,
          userId: dto.userId,
          role: dto.role,
          allocationPct: dto.allocationPct ?? null,
          hourlyRate: dto.hourlyRate ?? null,
        },
        update: {
          role: dto.role,
          allocationPct: dto.allocationPct ?? null,
          hourlyRate: dto.hourlyRate ?? null,
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
      return ok(member);
    } catch (e) {
      return err('Failed to add member', 'MEMBER_ADD_FAILED');
    }
  }

  async removeMember(
    gabineteId: string,
    projectId: string,
    userId: string,
  ): Promise<Result<void>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');
      if (project.managerId === userId) {
        return err('Cannot remove project manager', 'CANNOT_REMOVE_MANAGER');
      }
      await this.prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId } },
      });
      return ok(undefined);
    } catch (e) {
      return err('Failed to remove member', 'MEMBER_REMOVE_FAILED');
    }
  }

  // ── Milestones ───────────────────────────────────────
  async addMilestone(
    gabineteId: string,
    projectId: string,
    dto: CreateMilestoneDto,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId, deletedAt: null },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const count = await this.prisma.projectMilestone.count({ where: { projectId } });
      const milestone = await this.prisma.projectMilestone.create({
        data: {
          projectId,
          title: dto.title,
          description: dto.description ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: new Date(dto.dueDate),
          progress: dto.progress ?? 0,
          dependsOnId: dto.dependsOnId ?? null,
          position: dto.position ?? count,
        },
      });
      return ok(milestone);
    } catch (e) {
      return err('Failed to add milestone', 'MILESTONE_ADD_FAILED');
    }
  }

  async updateMilestone(
    gabineteId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ): Promise<Result<any>> {
    try {
      const milestone = await this.prisma.projectMilestone.findFirst({
        where: { id: milestoneId, project: { gabineteId } },
      });
      if (!milestone) return err('Milestone not found', 'MILESTONE_NOT_FOUND');

      const updated = await this.prisma.projectMilestone.update({
        where: { id: milestoneId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.startDate !== undefined && {
            startDate: dto.startDate ? new Date(dto.startDate) : null,
          }),
          ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
          ...(dto.progress !== undefined && { progress: dto.progress }),
          ...(dto.dependsOnId !== undefined && { dependsOnId: dto.dependsOnId }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.completedAt !== undefined && {
            completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
          }),
        },
      });
      return ok(updated);
    } catch (e) {
      return err('Failed to update milestone', 'MILESTONE_UPDATE_FAILED');
    }
  }

  // ── Linked processos ─────────────────────────────────
  /**
   * Returns processos in the gabinete not yet linked to this project.
   * Useful for the "pick processo" UI.
   */
  async listLinkableProcessos(
    gabineteId: string,
    projectId: string,
    search?: string,
  ): Promise<Result<any[]>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId, deletedAt: null },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const processos = await this.prisma.processo.findMany({
        where: {
          gabineteId,
          deletedAt: null,
          OR: [{ projectId: null }, { projectId: { not: projectId } }],
          ...(search && {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { processoNumber: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        select: {
          id: true,
          processoNumber: true,
          title: true,
          status: true,
          type: true,
          projectId: true,
          cliente: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      return ok(processos);
    } catch (e) {
      return err('Failed to list linkable processos', 'LINK_LIST_FAILED');
    }
  }

  async linkProcesso(
    gabineteId: string,
    projectId: string,
    processoId: string,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId, deletedAt: null },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const processo = await this.prisma.processo.findFirst({
        where: { id: processoId, gabineteId, deletedAt: null },
      });
      if (!processo) return err('Processo not found', 'PROCESSO_NOT_FOUND');

      const updated = await this.prisma.processo.update({
        where: { id: processoId },
        data: { projectId },
        select: {
          id: true,
          processoNumber: true,
          title: true,
          status: true,
          projectId: true,
        },
      });
      return ok(updated);
    } catch (e) {
      return err('Failed to link processo', 'LINK_PROCESSO_FAILED');
    }
  }

  async unlinkProcesso(
    gabineteId: string,
    projectId: string,
    processoId: string,
  ): Promise<Result<any>> {
    try {
      const processo = await this.prisma.processo.findFirst({
        where: { id: processoId, gabineteId, projectId },
      });
      if (!processo) {
        return err('Processo not linked to this project', 'PROCESSO_NOT_LINKED');
      }
      const updated = await this.prisma.processo.update({
        where: { id: processoId },
        data: { projectId: null },
        select: { id: true, projectId: true },
      });
      return ok(updated);
    } catch (e) {
      return err('Failed to unlink processo', 'UNLINK_PROCESSO_FAILED');
    }
  }

  // ── Burn-down (budget vs timeline) ──────────────────
  /**
   * Computes a daily burn-down series for the project, aggregating time
   * entries and expenses from linked processos into a cumulative "spent"
   * figure plotted against an ideal linear burn line from project start→end.
   *
   * Returns { budget, currency, series: [{ date, actualSpent, idealSpent }] }
   */
  async getBurndown(gabineteId: string, projectId: string): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId, deletedAt: null },
        include: {
          members: true,
          processos: { select: { id: true } },
        },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const processoIds = project.processos.map((p) => p.id);
      const start = project.startDate ?? project.createdAt;
      const end = project.endDate ?? new Date(Date.now() + 90 * 86_400_000);
      if (!start) {
        return err('Project has no start date', 'NO_START_DATE');
      }

      const rates = new Map<string, number>();
      project.members.forEach((m) => {
        if (m.hourlyRate) rates.set(m.userId, m.hourlyRate);
      });

      const [timeEntries, expenses] = await Promise.all([
        processoIds.length
          ? this.prisma.timeEntry.findMany({
              where: { processoId: { in: processoIds } },
              select: { date: true, durationMinutes: true, userId: true },
            })
          : Promise.resolve([]),
        processoIds.length
          ? this.prisma.expense.findMany({
              where: { processoId: { in: processoIds } },
              select: { date: true, amount: true },
            })
          : Promise.resolve([]),
      ]);

      // Bucket by day (local date string YYYY-MM-DD)
      const buckets = new Map<string, number>(); // date → cost in centavos
      const addToBucket = (d: Date | string, cost: number) => {
        const key =
          (typeof d === 'string' ? d : d.toISOString()).slice(0, 10) ?? 'unknown';
        buckets.set(key, (buckets.get(key) ?? 0) + cost);
      };
      timeEntries.forEach((t) => {
        const rate = rates.get(t.userId) ?? 0;
        const cost = Math.round((rate * t.durationMinutes) / 60);
        addToBucket(t.date, cost);
      });
      expenses.forEach((e) => addToBucket(e.date, e.amount));

      // Build daily series from start to end
      const startDay = new Date(start);
      startDay.setUTCHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setUTCHours(0, 0, 0, 0);
      const budget = project.budgetAmount ?? 0;
      const totalDays = Math.max(
        1,
        Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000),
      );

      const series: {
        date: string;
        actualSpent: number;
        idealSpent: number;
      }[] = [];
      let cumulative = 0;
      for (let i = 0; i <= totalDays; i++) {
        const d = new Date(startDay.getTime() + i * 86_400_000);
        const key = d.toISOString().slice(0, 10);
        const daySpend = buckets.get(key) ?? 0;
        cumulative += daySpend;
        const idealSpent = budget ? Math.round((budget * i) / totalDays) : 0;
        series.push({ date: key, actualSpent: cumulative, idealSpent });
      }

      return ok({
        budget,
        currency: project.budgetCurrency,
        totalSpent: cumulative,
        series,
      });
    } catch (e) {
      return err('Failed to compute burndown', 'BURNDOWN_FAILED');
    }
  }

  async deleteMilestone(
    gabineteId: string,
    milestoneId: string,
  ): Promise<Result<void>> {
    try {
      const milestone = await this.prisma.projectMilestone.findFirst({
        where: { id: milestoneId, project: { gabineteId } },
      });
      if (!milestone) return err('Milestone not found', 'MILESTONE_NOT_FOUND');
      await this.prisma.projectMilestone.delete({ where: { id: milestoneId } });
      return ok(undefined);
    } catch (e) {
      return err('Failed to delete milestone', 'MILESTONE_DELETE_FAILED');
    }
  }

  async getBudget(gabineteId: string, projectId: string): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, gabineteId, deletedAt: null },
        include: {
          members: true,
          processos: {
            select: { id: true },
          },
        },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const processoIds = project.processos.map((p) => p.id);

      const [timeEntries, expenses] = await Promise.all([
        processoIds.length
          ? this.prisma.timeEntry.findMany({
              where: { processoId: { in: processoIds } },
              select: { durationMinutes: true, userId: true, billable: true },
            })
          : Promise.resolve([]),
        processoIds.length
          ? this.prisma.expense.findMany({
              where: { processoId: { in: processoIds } },
              select: { amount: true },
            })
          : Promise.resolve([]),
      ]);

      const memberRates = new Map<string, number>();
      project.members.forEach((m) => {
        if (m.hourlyRate) memberRates.set(m.userId, m.hourlyRate);
      });

      const timeCost = timeEntries.reduce((sum, t) => {
        const rate = memberRates.get(t.userId) ?? 0;
        return sum + (rate * t.durationMinutes) / 60;
      }, 0);
      const expenseCost = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalSpent = Math.round(timeCost + expenseCost);
      const budget = project.budgetAmount ?? 0;
      const remaining = budget ? budget - totalSpent : null;

      return ok({
        budget,
        spent: totalSpent,
        remaining,
        breakdown: {
          timeCost: Math.round(timeCost),
          expenseCost,
        },
        currency: project.budgetCurrency,
      });
    } catch (e) {
      return err('Failed to compute budget', 'BUDGET_COMPUTE_FAILED');
    }
  }

  // Generates short unique code like "MA-2026-001"
  private async nextCode(gabineteId: string, category: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = category === 'DUE_DILIGENCE' ? 'DD' : category;
    const count = await this.prisma.project.count({
      where: { gabineteId, code: { startsWith: `${prefix}-${year}-` } },
    });
    const seq = String(count + 1).padStart(3, '0');
    return `${prefix}-${year}-${seq}`;
  }
}
