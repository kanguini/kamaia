import { Injectable } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { AuditService } from '../audit/audit.service';
import {
  Result,
  ok,
  err,
  AuditAction,
  EntityType,
  KamaiaRole,
} from '@kamaia/shared-types';
import {
  CreateColumnDto,
  UpdateColumnDto,
  ReorderColumnsDto,
  CreateTaskDto,
  UpdateTaskDto,
  MoveTaskDto,
  CreateCheckItemDto,
  UpdateCheckItemDto,
  CreateCommentDto,
} from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private tasksRepository: TasksRepository,
    private auditService: AuditService,
  ) {}

  // ── Columns ────────────────────────────────────────────

  async getBoard(gabineteId: string): Promise<Result<any>> {
    try {
      // Auto-initialize default columns on first access
      await this.tasksRepository.initializeDefaultColumns(gabineteId);

      const columns = await this.tasksRepository.findColumns(gabineteId);
      return ok(columns);
    } catch (error) {
      return err('Failed to fetch board', 'BOARD_FETCH_FAILED');
    }
  }

  async createColumn(
    gabineteId: string,
    userId: string,
    dto: CreateColumnDto,
  ): Promise<Result<any>> {
    try {
      const column = await this.tasksRepository.createColumn(gabineteId, dto);

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.TASK_COLUMN,
        entityId: column.id,
        userId,
        gabineteId,
        newValue: { title: column.title },
      });

      return ok(column);
    } catch (error) {
      return err('Failed to create column', 'COLUMN_CREATE_FAILED');
    }
  }

  async updateColumn(
    gabineteId: string,
    userId: string,
    columnId: string,
    dto: UpdateColumnDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.tasksRepository.findColumnById(gabineteId, columnId);
      if (!existing) {
        return err('Column not found', 'COLUMN_NOT_FOUND');
      }

      const column = await this.tasksRepository.updateColumn(gabineteId, columnId, dto);

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.TASK_COLUMN,
        entityId: columnId,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
        newValue: { title: column?.title },
      });

      return ok(column);
    } catch (error) {
      return err('Failed to update column', 'COLUMN_UPDATE_FAILED');
    }
  }

  async deleteColumn(
    gabineteId: string,
    userId: string,
    columnId: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.tasksRepository.findColumnById(gabineteId, columnId);
      if (!existing) {
        return err('Column not found', 'COLUMN_NOT_FOUND');
      }

      // Prevent deletion of columns with tasks
      const taskCount = await this.tasksRepository.countTasksInColumn(gabineteId, columnId);
      if (taskCount > 0) {
        return err(
          'Cannot delete column with tasks. Move or delete tasks first.',
          'COLUMN_NOT_EMPTY',
        );
      }

      await this.tasksRepository.deleteColumn(gabineteId, columnId);

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.TASK_COLUMN,
        entityId: columnId,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete column', 'COLUMN_DELETE_FAILED');
    }
  }

  async reorderColumns(
    gabineteId: string,
    userId: string,
    dto: ReorderColumnsDto,
  ): Promise<Result<any>> {
    try {
      await this.tasksRepository.reorderColumns(gabineteId, dto.columnIds);
      const columns = await this.tasksRepository.findColumns(gabineteId);

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.TASK_COLUMN,
        userId,
        gabineteId,
        newValue: { reorderedColumnIds: dto.columnIds },
      });

      return ok(columns);
    } catch (error) {
      return err('Failed to reorder columns', 'COLUMNS_REORDER_FAILED');
    }
  }

  // ── Tasks ──────────────────────────────────────────────

  async createTask(
    gabineteId: string,
    userId: string,
    dto: CreateTaskDto,
  ): Promise<Result<any>> {
    try {
      // Validate column belongs to gabinete
      const column = await this.tasksRepository.findColumnById(gabineteId, dto.columnId);
      if (!column) {
        return err('Column not found', 'COLUMN_NOT_FOUND');
      }

      const task = await this.tasksRepository.createTask(gabineteId, {
        ...dto,
        createdById: userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      });

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.TASK,
        entityId: task.id,
        userId,
        gabineteId,
        newValue: { title: task.title, columnId: dto.columnId },
      });

      return ok(task);
    } catch (error) {
      return err('Failed to create task', 'TASK_CREATE_FAILED');
    }
  }

  async updateTask(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!existing) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      // ADVOGADO_MEMBRO can only edit own tasks
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.createdById !== userId && existing.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // If columnId is changing, validate the new column
      if (dto.columnId) {
        const column = await this.tasksRepository.findColumnById(gabineteId, dto.columnId);
        if (!column) {
          return err('Column not found', 'COLUMN_NOT_FOUND');
        }
      }

      const updateData: any = { ...dto };
      if (dto.dueDate !== undefined) {
        updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      }

      const task = await this.tasksRepository.updateTask(gabineteId, taskId, updateData);

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.TASK,
        entityId: taskId,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
        newValue: { title: task?.title },
      });

      return ok(task);
    } catch (error) {
      return err('Failed to update task', 'TASK_UPDATE_FAILED');
    }
  }

  async deleteTask(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!existing) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      // ADVOGADO_MEMBRO can only delete own tasks
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.createdById !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.tasksRepository.softDeleteTask(gabineteId, taskId);

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.TASK,
        entityId: taskId,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete task', 'TASK_DELETE_FAILED');
    }
  }

  async moveTask(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
    dto: MoveTaskDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!existing) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      // ADVOGADO_MEMBRO can only move own tasks
      if (role === KamaiaRole.ADVOGADO_MEMBRO && existing.createdById !== userId && existing.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Validate target column
      const targetColumn = await this.tasksRepository.findColumnById(gabineteId, dto.columnId);
      if (!targetColumn) {
        return err('Target column not found', 'COLUMN_NOT_FOUND');
      }

      const task = await this.tasksRepository.moveTask(
        gabineteId,
        taskId,
        dto.columnId,
        dto.position,
      );

      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      // Auto-set completedAt when task moves to a "done" column
      const isDoneColumn =
        targetColumn.title.toLowerCase().includes('concluido') ||
        targetColumn.title.toLowerCase().includes('done');
      const wasNotDone = !existing.completedAt;

      if (isDoneColumn && wasNotDone) {
        await this.tasksRepository.updateTask(gabineteId, taskId, {
          completedAt: new Date(),
        });
      } else if (!isDoneColumn && existing.completedAt) {
        // If moved out of done column, clear completedAt
        await this.tasksRepository.updateTask(gabineteId, taskId, {
          completedAt: null,
        });
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.TASK,
        entityId: taskId,
        userId,
        gabineteId,
        oldValue: { columnId: existing.columnId },
        newValue: { columnId: dto.columnId, position: dto.position },
      });

      // Re-fetch to get updated completedAt
      const updated = await this.tasksRepository.findTaskById(gabineteId, taskId);
      return ok(updated);
    } catch (error) {
      return err('Failed to move task', 'TASK_MOVE_FAILED');
    }
  }

  async getTaskDetail(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
  ): Promise<Result<any>> {
    try {
      const task = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      // ADVOGADO_MEMBRO can only view tasks assigned to or created by them
      if (role === KamaiaRole.ADVOGADO_MEMBRO && task.createdById !== userId && task.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      return ok(task);
    } catch (error) {
      return err('Failed to fetch task', 'TASK_FETCH_FAILED');
    }
  }

  // ── Checklist ──────────────────────────────────────────

  async createCheckItem(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
    dto: CreateCheckItemDto,
  ): Promise<Result<any>> {
    try {
      const task = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      if (role === KamaiaRole.ADVOGADO_MEMBRO && task.createdById !== userId && task.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const item = await this.tasksRepository.createCheckItem(taskId, dto);

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.TASK,
        entityId: taskId,
        userId,
        gabineteId,
        newValue: { checkItem: item.title },
      });

      return ok(item);
    } catch (error) {
      return err('Failed to create check item', 'CHECK_ITEM_CREATE_FAILED');
    }
  }

  async updateCheckItem(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
    itemId: string,
    dto: UpdateCheckItemDto,
  ): Promise<Result<any>> {
    try {
      const task = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      if (role === KamaiaRole.ADVOGADO_MEMBRO && task.createdById !== userId && task.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const item = await this.tasksRepository.updateCheckItem(itemId, dto);
      return ok(item);
    } catch (error) {
      return err('Failed to update check item', 'CHECK_ITEM_UPDATE_FAILED');
    }
  }

  async deleteCheckItem(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
    itemId: string,
  ): Promise<Result<void>> {
    try {
      const task = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      if (role === KamaiaRole.ADVOGADO_MEMBRO && task.createdById !== userId && task.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.tasksRepository.deleteCheckItem(itemId);
      return ok(undefined);
    } catch (error) {
      return err('Failed to delete check item', 'CHECK_ITEM_DELETE_FAILED');
    }
  }

  // ── Comments ───────────────────────────────────────────

  async createComment(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
    dto: CreateCommentDto,
  ): Promise<Result<any>> {
    try {
      const task = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      // All roles with access to the task can comment
      if (role === KamaiaRole.ADVOGADO_MEMBRO && task.createdById !== userId && task.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const comment = await this.tasksRepository.createComment(taskId, userId, dto.content);

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.TASK,
        entityId: taskId,
        userId,
        gabineteId,
        newValue: { comment: dto.content.substring(0, 100) },
      });

      return ok(comment);
    } catch (error) {
      return err('Failed to create comment', 'COMMENT_CREATE_FAILED');
    }
  }

  async getComments(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    taskId: string,
  ): Promise<Result<any>> {
    try {
      const task = await this.tasksRepository.findTaskById(gabineteId, taskId);
      if (!task) {
        return err('Task not found', 'TASK_NOT_FOUND');
      }

      if (role === KamaiaRole.ADVOGADO_MEMBRO && task.createdById !== userId && task.assigneeId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const comments = await this.tasksRepository.findComments(taskId);
      return ok(comments);
    } catch (error) {
      return err('Failed to fetch comments', 'COMMENTS_FETCH_FAILED');
    }
  }
}
