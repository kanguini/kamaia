import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowsService } from '../workflows/workflows.service';
import {
  Result,
  ok,
  err,
  AuditAction,
  EntityType,
  KamaiaRole,
  PROJECT_TEMPLATES,
  findProjectTemplate,
  ProjectTemplate,
} from '@kamaia/shared-types';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
  AddMemberDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  FromTemplateDto,
  CreateCustomTemplateDto,
  UpdateCustomTemplateDto,
  DuplicateSystemTemplateDto,
} from './projects.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private workflows: WorkflowsService,
  ) {}

  /** Log unexpected exceptions with context before returning a Result.err. */
  private logError(ctx: string, e: unknown): void {
    const err = e as { code?: string; message?: string };
    this.logger.error(
      `${ctx} — ${err.code ?? ''} ${err.message ?? String(e)}`.trim(),
      e instanceof Error ? e.stack : undefined,
    );
  }

  /**
   * Cláusula WHERE parcial que restringe projectos MEMBERS_ONLY a quem os
   * pode efectivamente ver: sócio-gestor, advogado solo (ele é o gabinete),
   * ou alguém com relação directa — manager, sponsor ou member. Para
   * projectos PUBLIC qualquer utilizador do gabinete passa. Admins
   * (SOCIO_GESTOR/ADVOGADO_SOLO) são sempre transparentes — voltam `{}`.
   *
   * Público porque o ProjectReportsService aplica a mesma filtragem nos
   * seus pré-fetch de projecto via `project: { ... }` relation filter.
   */
  projectAccessWhere(
    userId: string,
    userRole: KamaiaRole,
  ): Record<string, unknown> {
    if (
      userRole === KamaiaRole.SOCIO_GESTOR ||
      userRole === KamaiaRole.ADVOGADO_SOLO
    ) {
      return {};
    }
    return {
      OR: [
        { visibility: 'PUBLIC' },
        { managerId: userId },
        { sponsorId: userId },
        { members: { some: { userId } } },
      ],
    };
  }

  async list(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    params: ListProjectsDto,
  ): Promise<Result<any>> {
    try {
      const access = this.projectAccessWhere(userId, userRole);
      const baseOr = access.OR as unknown[] | undefined;
      const where: any = { gabineteId, deletedAt: null };
      if (params.status) where.status = params.status;
      if (params.category) where.category = params.category;
      if (params.managerId) where.managerId = params.managerId;
      if (params.clienteId) where.clienteId = params.clienteId;

      // Combina dois OR (pesquisa + acesso) via AND para não se anularem.
      const accessBlock = baseOr ? [{ OR: baseOr }] : [];
      if (params.search) {
        const searchBlock = {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { code: { contains: params.search, mode: 'insensitive' } },
          ],
        };
        if (accessBlock.length) where.AND = [...accessBlock, searchBlock];
        else where.OR = searchBlock.OR;
      } else if (accessBlock.length) {
        where.AND = accessBlock;
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
      this.logError(`list(gabinete=${gabineteId})`, e);
      return err('Failed to list projects', 'PROJECTS_LIST_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
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
          milestones: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
          processos: {
            select: { id: true, title: true, processoNumber: true, status: true, stage: true },
            take: 50,
          },
        },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');
      return ok(project);
    } catch (e) {
      this.logError(`findById(id=${id}, gabinete=${gabineteId})`, e);
      return err('Failed to fetch project', 'PROJECT_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateProjectDto,
  ): Promise<Result<any>> {
    // Nota: não fazemos pré-check de duplicado do código. Confiamos no índice
    // único (gabineteId, code) e apanhamos P2002 aqui — remove a race
    // check-then-insert em que dois POST concorrentes geravam o mesmo código.
    const code = dto.code ?? (await this.nextCode(gabineteId, dto.category));
    try {
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
          budgetCurrency: dto.budgetCurrency ?? 'AOA',
          visibility: dto.visibility ?? 'PUBLIC',
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
        entity: EntityType.PROJECT,
        entityId: project.id,
        userId,
        gabineteId,
        newValue: { kind: 'project', code, category: dto.category },
      });

      return ok(project);
    } catch (e) {
      const prismaErr = e as { code?: string; meta?: { target?: unknown } };
      if (prismaErr.code === 'P2002') {
        const target = Array.isArray(prismaErr.meta?.target)
          ? (prismaErr.meta!.target as string[]).join(',')
          : String(prismaErr.meta?.target ?? '');
        if (target.includes('code')) {
          this.logger.warn(
            `Project code collision (gabinete=${gabineteId}, code=${code}) — retry suggested`,
          );
          return err('Project code collision, retry', 'PROJECT_CODE_EXISTS');
        }
      }
      this.logError(`create(gabinete=${gabineteId}, code=${code})`, e);
      return err('Failed to create project', 'PROJECT_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    id: string,
    dto: UpdateProjectDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prisma.project.findFirst({
        where: {
          id,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
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
          ...(dto.visibility !== undefined && { visibility: dto.visibility }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.risksJson !== undefined && { risksJson: dto.risksJson as any }),
        },
      });

      await this.audit.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROJECT,
        entityId: id,
        userId,
        gabineteId,
        newValue: { kind: 'project' },
      });

      return ok(updated);
    } catch (e) {
      this.logError(`update(id=${id}, gabinete=${gabineteId})`, e);
      return err('Failed to update project', 'PROJECT_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.prisma.project.findFirst({
        where: {
          id,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
      });
      if (!existing) return err('Project not found', 'PROJECT_NOT_FOUND');

      await this.prisma.project.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'CANCELADO' },
      });

      await this.audit.log({
        action: AuditAction.DELETE,
        entity: EntityType.PROJECT,
        entityId: id,
        userId,
        gabineteId,
        newValue: { kind: 'project' },
      });

      return ok(undefined);
    } catch (e) {
      this.logError(`delete(id=${id}, gabinete=${gabineteId})`, e);
      return err('Failed to delete project', 'PROJECT_DELETE_FAILED');
    }
  }

  // ── Members ──────────────────────────────────────────
  async addMember(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
    dto: AddMemberDto,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
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
      this.logError(
        `addMember(project=${projectId}, user=${dto.userId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to add member', 'MEMBER_ADD_FAILED');
    }
  }

  async removeMember(
    gabineteId: string,
    actorUserId: string,
    actorUserRole: KamaiaRole,
    projectId: string,
    memberUserId: string,
  ): Promise<Result<void>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          ...this.projectAccessWhere(actorUserId, actorUserRole),
        },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');
      if (project.managerId === memberUserId) {
        return err('Cannot remove project manager', 'CANNOT_REMOVE_MANAGER');
      }
      await this.prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId: memberUserId } },
      });
      return ok(undefined);
    } catch (e) {
      this.logError(
        `removeMember(project=${projectId}, user=${memberUserId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to remove member', 'MEMBER_REMOVE_FAILED');
    }
  }

  // ── Milestones ───────────────────────────────────────
  async addMilestone(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
    dto: CreateMilestoneDto,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

      const count = await this.prisma.projectMilestone.count({
        where: { projectId, deletedAt: null },
      });
      const milestone = await this.prisma.projectMilestone.create({
        data: {
          projectId,
          title: dto.title,
          description: dto.description ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: new Date(dto.dueDate),
          progress: dto.progress ?? 0,
          budgetCents: dto.budgetCents ?? null,
          dependsOnId: dto.dependsOnId ?? null,
          position: dto.position ?? count,
        },
      });
      return ok(milestone);
    } catch (e) {
      this.logError(
        `addMilestone(project=${projectId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to add milestone', 'MILESTONE_ADD_FAILED');
    }
  }

  async updateMilestone(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ): Promise<Result<any>> {
    try {
      const milestone = await this.prisma.projectMilestone.findFirst({
        where: {
          id: milestoneId,
          project: {
            gabineteId,
            ...this.projectAccessWhere(userId, userRole),
          },
          deletedAt: null,
        },
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
          ...(dto.budgetCents !== undefined && { budgetCents: dto.budgetCents }),
          ...(dto.dependsOnId !== undefined && { dependsOnId: dto.dependsOnId }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.completedAt !== undefined && {
            completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
          }),
        },
      });
      return ok(updated);
    } catch (e) {
      this.logError(
        `updateMilestone(id=${milestoneId}, gabinete=${gabineteId})`,
        e,
      );
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
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
    search?: string,
  ): Promise<Result<any[]>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
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
      this.logError(
        `listLinkableProcessos(project=${projectId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to list linkable processos', 'LINK_LIST_FAILED');
    }
  }

  async linkProcesso(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
    processoId: string,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
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
      this.logError(
        `linkProcesso(project=${projectId}, processo=${processoId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to link processo', 'LINK_PROCESSO_FAILED');
    }
  }

  async unlinkProcesso(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
    processoId: string,
  ): Promise<Result<any>> {
    try {
      // Visibility gate no projecto — evita unlink por quem não deveria ver.
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
        select: { id: true },
      });
      if (!project) return err('Project not found', 'PROJECT_NOT_FOUND');

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
      this.logError(
        `unlinkProcesso(project=${projectId}, processo=${processoId}, gabinete=${gabineteId})`,
        e,
      );
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
  async getBurndown(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
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
      this.logError(
        `getBurndown(project=${projectId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to compute burndown', 'BURNDOWN_FAILED');
    }
  }

  async deleteMilestone(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    milestoneId: string,
  ): Promise<Result<void>> {
    try {
      const milestone = await this.prisma.projectMilestone.findFirst({
        where: {
          id: milestoneId,
          project: {
            gabineteId,
            ...this.projectAccessWhere(userId, userRole),
          },
          deletedAt: null,
        },
      });
      if (!milestone) return err('Milestone not found', 'MILESTONE_NOT_FOUND');
      await this.prisma.projectMilestone.update({
        where: { id: milestoneId },
        data: { deletedAt: new Date() },
      });
      return ok(undefined);
    } catch (e) {
      this.logError(
        `deleteMilestone(id=${milestoneId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to delete milestone', 'MILESTONE_DELETE_FAILED');
    }
  }

  async getBudget(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    projectId: string,
  ): Promise<Result<any>> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          gabineteId,
          deletedAt: null,
          ...this.projectAccessWhere(userId, userRole),
        },
        include: {
          members: true,
          processos: {
            select: { id: true },
          },
          // Milestones são a referência do "planeado por fase" — a soma
          // dá-nos o planned bottom-up para contrastar com `budgetAmount`
          // (planned top-down). Gap sinaliza phases em falta ou budget
          // desalinhado com breakdown.
          milestones: {
            where: { deletedAt: null },
            select: { budgetCents: true },
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

      // Roll-up bottom-up a partir das milestones. `null` só aparece
      // explicitamente quando nenhuma milestone tem budgetCents definido —
      // evita dar 0 e sugerir que está "tudo planeado a zero".
      const milestonesWithBudget = project.milestones.filter(
        (m) => typeof m.budgetCents === 'number',
      );
      const plannedMilestones = milestonesWithBudget.length
        ? milestonesWithBudget.reduce((s, m) => s + (m.budgetCents ?? 0), 0)
        : null;
      const plannedGap =
        budget && plannedMilestones !== null ? budget - plannedMilestones : null;

      return ok({
        budget,
        spent: totalSpent,
        remaining,
        plannedMilestones,
        plannedGap,
        breakdown: {
          timeCost: Math.round(timeCost),
          expenseCost,
        },
        currency: project.budgetCurrency,
      });
    } catch (e) {
      this.logError(
        `getBudget(project=${projectId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to compute budget', 'BUDGET_COMPUTE_FAILED');
    }
  }

  // Generates short unique code like "MA-2026-001"
  // ── Templates ────────────────────────────────────────
  /**
   * Returns the merged template catalog: system templates (from code) +
   * custom templates for the gabinete (from DB). Custom entries have
   * `custom: true` so the UI can render edit/delete actions.
   */
  async listTemplates(gabineteId: string): Promise<any[]> {
    const custom = await this.prisma.projectTemplateCustom.findMany({
      where: { gabineteId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
    });
    const systemEntries = PROJECT_TEMPLATES.map((t) => ({
      id: t.id,
      category: t.category,
      name: t.name,
      description: t.description,
      scopeBlurb: t.scopeBlurb,
      objectivesBlurb: t.objectivesBlurb,
      defaultDurationDays: t.defaultDurationDays,
      milestones: t.milestones,
      custom: false as const,
      basedOnSystemId: null,
    }));
    const customEntries = custom.map((t) => ({
      id: t.id,
      category: t.category,
      name: t.name,
      description: t.description,
      scopeBlurb: t.scopeBlurb,
      objectivesBlurb: t.objectivesBlurb,
      defaultDurationDays: t.defaultDurationDays,
      milestones: t.milestones as unknown as ProjectTemplate['milestones'],
      custom: true as const,
      basedOnSystemId: t.basedOnSystemId,
    }));
    return [...customEntries, ...systemEntries];
  }

  /** Resolves a template by id — prefers custom (gabinete) over system. */
  private async resolveTemplate(
    gabineteId: string,
    templateId: string,
  ): Promise<ProjectTemplate | null> {
    // Custom id is a UUID; system id is a slug.
    const isUuid = /^[0-9a-f-]{36}$/i.test(templateId);
    if (isUuid) {
      const custom = await this.prisma.projectTemplateCustom.findFirst({
        where: { id: templateId, gabineteId, isArchived: false },
      });
      if (custom) {
        return {
          id: custom.id,
          category: custom.category as ProjectTemplate['category'],
          name: custom.name,
          description: custom.description ?? '',
          scopeBlurb: custom.scopeBlurb ?? '',
          objectivesBlurb: custom.objectivesBlurb ?? undefined,
          defaultDurationDays: custom.defaultDurationDays,
          milestones: custom.milestones as unknown as ProjectTemplate['milestones'],
        };
      }
      return null;
    }
    return findProjectTemplate(templateId) ?? null;
  }

  async createCustomTemplate(
    gabineteId: string,
    dto: CreateCustomTemplateDto,
  ): Promise<Result<any>> {
    try {
      const created = await this.prisma.projectTemplateCustom.create({
        data: {
          gabineteId,
          category: dto.category,
          name: dto.name,
          description: dto.description ?? null,
          scopeBlurb: dto.scopeBlurb ?? null,
          objectivesBlurb: dto.objectivesBlurb ?? null,
          defaultDurationDays: dto.defaultDurationDays,
          milestones: dto.milestones as any,
          basedOnSystemId: dto.basedOnSystemId ?? null,
        },
      });
      return ok(created);
    } catch (e) {
      this.logError(`createCustomTemplate(gabinete=${gabineteId})`, e);
      return err('Failed to create custom template', 'CUSTOM_TEMPLATE_CREATE_FAILED');
    }
  }

  async updateCustomTemplate(
    gabineteId: string,
    id: string,
    dto: UpdateCustomTemplateDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prisma.projectTemplateCustom.findFirst({
        where: { id, gabineteId },
      });
      if (!existing) return err('Template not found', 'TEMPLATE_NOT_FOUND');

      const updated = await this.prisma.projectTemplateCustom.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.scopeBlurb !== undefined && { scopeBlurb: dto.scopeBlurb }),
          ...(dto.objectivesBlurb !== undefined && { objectivesBlurb: dto.objectivesBlurb }),
          ...(dto.defaultDurationDays !== undefined && {
            defaultDurationDays: dto.defaultDurationDays,
          }),
          ...(dto.milestones !== undefined && { milestones: dto.milestones as any }),
        },
      });
      return ok(updated);
    } catch (e) {
      this.logError(
        `updateCustomTemplate(id=${id}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to update custom template', 'CUSTOM_TEMPLATE_UPDATE_FAILED');
    }
  }

  async deleteCustomTemplate(
    gabineteId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.prisma.projectTemplateCustom.findFirst({
        where: { id, gabineteId },
      });
      if (!existing) return err('Template not found', 'TEMPLATE_NOT_FOUND');
      await this.prisma.projectTemplateCustom.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      this.logError(
        `deleteCustomTemplate(id=${id}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to delete custom template', 'CUSTOM_TEMPLATE_DELETE_FAILED');
    }
  }

  /**
   * Duplicates a system template into the gabinete's DB-backed catalog,
   * ready to be edited (rename, reorder milestones, add new ones).
   */
  async duplicateSystemTemplate(
    gabineteId: string,
    dto: DuplicateSystemTemplateDto,
  ): Promise<Result<any>> {
    try {
      const system = findProjectTemplate(dto.systemId);
      if (!system) return err('System template not found', 'TEMPLATE_NOT_FOUND');

      const created = await this.prisma.projectTemplateCustom.create({
        data: {
          gabineteId,
          category: system.category,
          name: dto.name ?? `${system.name} (cópia)`,
          description: system.description,
          scopeBlurb: system.scopeBlurb,
          objectivesBlurb: system.objectivesBlurb ?? null,
          defaultDurationDays: system.defaultDurationDays,
          milestones: system.milestones as any,
          basedOnSystemId: system.id,
        },
      });
      return ok(created);
    } catch (e) {
      this.logError(
        `duplicateSystemTemplate(systemId=${dto.systemId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to duplicate template', 'TEMPLATE_DUPLICATE_FAILED');
    }
  }

  /**
   * Materialises a full project + workflow (default for the category) +
   * milestones from a template (system OR custom). Everything is created
   * in a single transaction so the project never exists in a partial state.
   */
  async createFromTemplate(
    gabineteId: string,
    userId: string,
    userRole: KamaiaRole,
    dto: FromTemplateDto,
  ): Promise<Result<any>> {
    try {
      const template = await this.resolveTemplate(gabineteId, dto.templateId);
      if (!template) return err('Template not found', 'TEMPLATE_NOT_FOUND');

      const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
      const endDate = new Date(
        startDate.getTime() + template.defaultDurationDays * 86_400_000,
      );
      const code = await this.nextCode(gabineteId, template.category);

      // Resolve default workflow for the category (auto-seeds if needed)
      const workflow = await this.workflows.getDefaultFor(
        gabineteId,
        'PROJECT',
        template.category,
      );

      const project = await this.prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            gabineteId,
            code,
            name: dto.name,
            category: template.category,
            clienteId: dto.clienteId ?? null,
            managerId: userId,
            workflowId: workflow?.id ?? null,
            status: 'ACTIVO',
            healthStatus: 'GREEN',
            scope: template.scopeBlurb,
            objectives: template.objectivesBlurb ?? null,
            startDate,
            endDate,
            budgetAmount: dto.budgetAmount ?? null,
            tags: [`template:${template.id}`],
          },
        });

        // Manager is automatically ACCOUNTABLE
        await tx.projectMember.create({
          data: {
            projectId: created.id,
            userId,
            role: 'ACCOUNTABLE',
          },
        });

        // Materialise milestones from template offsets
        await tx.projectMilestone.createMany({
          data: template.milestones.map((m, i) => ({
            projectId: created.id,
            title: m.title,
            description: m.description ?? null,
            startDate: new Date(
              startDate.getTime() + m.startDayOffset * 86_400_000,
            ),
            dueDate: new Date(
              startDate.getTime() + m.dueDayOffset * 86_400_000,
            ),
            position: i,
            progress: 0,
          })),
        });

        return created;
      });

      await this.audit.log({
        action: AuditAction.CREATE,
        entity: EntityType.PROJECT,
        entityId: project.id,
        userId,
        gabineteId,
        newValue: { kind: 'project-from-template', templateId: template.id, code },
      });

      // Return full detail (with milestones) so the UI can navigate in.
      // Passamos o role do utilizador para a filtragem de visibility — o
      // criador é sempre manager, logo passa sempre.
      const full = await this.findById(gabineteId, userId, userRole, project.id);
      return full;
    } catch (e) {
      this.logError(
        `createFromTemplate(templateId=${dto.templateId}, gabinete=${gabineteId})`,
        e,
      );
      return err('Failed to create project from template', 'TEMPLATE_CREATE_FAILED');
    }
  }

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
