import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TASK_COLUMNS } from '@kamaia/shared-types';

@Injectable()
export class TasksRepository {
  constructor(private prisma: PrismaService) {}

  // ── Columns ────────────────────────────────────────────

  async findColumns(gabineteId: string) {
    return this.prisma.taskColumn.findMany({
      where: { gabineteId },
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            priority: true,
            position: true,
            dueDate: true,
            labels: true,
            completedAt: true,
            createdAt: true,
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            processo: {
              select: {
                id: true,
                title: true,
                processoNumber: true,
              },
            },
            cliente: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                checklist: true,
                comments: true,
              },
            },
          },
        },
      },
    });
  }

  async findColumnById(gabineteId: string, columnId: string) {
    return this.prisma.taskColumn.findFirst({
      where: { id: columnId, gabineteId },
    });
  }

  async createColumn(gabineteId: string, data: { title: string; color?: string }) {
    // Auto-set position to max+1
    const maxPos = await this.prisma.taskColumn.aggregate({
      where: { gabineteId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    return this.prisma.taskColumn.create({
      data: {
        ...data,
        gabineteId,
        position,
      },
    });
  }

  async updateColumn(gabineteId: string, columnId: string, data: { title?: string; color?: string | null }) {
    await this.prisma.taskColumn.updateMany({
      where: { id: columnId, gabineteId },
      data,
    });
    return this.findColumnById(gabineteId, columnId);
  }

  async deleteColumn(gabineteId: string, columnId: string) {
    return this.prisma.taskColumn.deleteMany({
      where: { id: columnId, gabineteId },
    });
  }

  async reorderColumns(gabineteId: string, columnIds: string[]) {
    const updates = columnIds.map((id, index) =>
      this.prisma.taskColumn.updateMany({
        where: { id, gabineteId },
        data: { position: index },
      }),
    );
    await this.prisma.$transaction(updates);
  }

  async countTasksInColumn(gabineteId: string, columnId: string): Promise<number> {
    return this.prisma.task.count({
      where: { columnId, gabineteId, deletedAt: null },
    });
  }

  async initializeDefaultColumns(gabineteId: string) {
    const existing = await this.prisma.taskColumn.count({ where: { gabineteId } });
    if (existing > 0) return;

    await this.prisma.taskColumn.createMany({
      data: DEFAULT_TASK_COLUMNS.map((col) => ({
        gabineteId,
        title: col.title,
        color: col.color,
        position: col.position,
      })),
    });
  }

  // ── Tasks ──────────────────────────────────────────────

  async findTaskById(gabineteId: string, taskId: string) {
    return this.prisma.task.findFirst({
      where: { id: taskId, gabineteId, deletedAt: null },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        processo: {
          select: {
            id: true,
            title: true,
            processoNumber: true,
          },
        },
        cliente: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        column: {
          select: {
            id: true,
            title: true,
            color: true,
          },
        },
        checklist: {
          orderBy: { position: 'asc' },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async createTask(gabineteId: string, data: any) {
    // Auto-set position to max+1 within column
    const maxPos = await this.prisma.task.aggregate({
      where: { columnId: data.columnId, gabineteId, deletedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    return this.prisma.task.create({
      data: {
        ...data,
        gabineteId,
        position,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async updateTask(gabineteId: string, taskId: string, data: any) {
    await this.prisma.task.updateMany({
      where: { id: taskId, gabineteId, deletedAt: null },
      data,
    });
    return this.findTaskById(gabineteId, taskId);
  }

  async softDeleteTask(gabineteId: string, taskId: string) {
    return this.prisma.task.updateMany({
      where: { id: taskId, gabineteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async moveTask(gabineteId: string, taskId: string, columnId: string, position: number) {
    // Get the task's current column and position
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, gabineteId, deletedAt: null },
      select: { columnId: true, position: true },
    });

    if (!task) return null;

    const isSameColumn = task.columnId === columnId;

    await this.prisma.$transaction(async (tx) => {
      if (isSameColumn) {
        // Moving within the same column
        if (position > task.position) {
          // Moving down: shift tasks between old and new position up
          await tx.task.updateMany({
            where: {
              gabineteId,
              columnId,
              deletedAt: null,
              position: { gt: task.position, lte: position },
              id: { not: taskId },
            },
            data: { position: { decrement: 1 } },
          });
        } else if (position < task.position) {
          // Moving up: shift tasks between new and old position down
          await tx.task.updateMany({
            where: {
              gabineteId,
              columnId,
              deletedAt: null,
              position: { gte: position, lt: task.position },
              id: { not: taskId },
            },
            data: { position: { increment: 1 } },
          });
        }
      } else {
        // Moving to a different column
        // Close the gap in the old column
        await tx.task.updateMany({
          where: {
            gabineteId,
            columnId: task.columnId,
            deletedAt: null,
            position: { gt: task.position },
          },
          data: { position: { decrement: 1 } },
        });
        // Make room in the new column
        await tx.task.updateMany({
          where: {
            gabineteId,
            columnId,
            deletedAt: null,
            position: { gte: position },
          },
          data: { position: { increment: 1 } },
        });
      }

      // Update the task itself
      await tx.task.update({
        where: { id: taskId },
        data: { columnId, position },
      });
    });

    return this.findTaskById(gabineteId, taskId);
  }

  // ── Checklist ──────────────────────────────────────────

  async createCheckItem(taskId: string, data: { title: string }) {
    const maxPos = await this.prisma.taskCheckItem.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    return this.prisma.taskCheckItem.create({
      data: {
        taskId,
        title: data.title,
        position,
      },
    });
  }

  async updateCheckItem(itemId: string, data: { title?: string; checked?: boolean }) {
    return this.prisma.taskCheckItem.update({
      where: { id: itemId },
      data,
    });
  }

  async deleteCheckItem(itemId: string) {
    return this.prisma.taskCheckItem.delete({
      where: { id: itemId },
    });
  }

  // ── Comments ───────────────────────────────────────────

  async createComment(taskId: string, userId: string, content: string) {
    return this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findComments(taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
