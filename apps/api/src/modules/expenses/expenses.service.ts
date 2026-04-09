import { Injectable } from '@nestjs/common';
import { ExpensesRepository, ListExpensesParams } from './expenses.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  KamaiaRole,
} from '@kamaia/shared-types';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
} from './expenses.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private expensesRepository: ExpensesRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    params: ListExpensesParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      // If ADVOGADO_MEMBRO, filter by processos they own
      let result = await this.expensesRepository.findAll(gabineteId, params);

      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        // Get user's processos
        const userProcessos = await this.prisma.processo.findMany({
          where: {
            gabineteId,
            advogadoId: userId,
            deletedAt: null,
          },
          select: { id: true },
        });

        const processoIds = new Set(userProcessos.map((p) => p.id));

        // Filter expenses
        result.data = result.data.filter((e: any) =>
          processoIds.has(e.processo.id),
        );
      }

      return ok(result);
    } catch (error) {
      return err('Failed to fetch expenses', 'EXPENSES_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const expense = await this.expensesRepository.findById(gabineteId, id);

      if (!expense) {
        return err('Expense not found', 'EXPENSE_NOT_FOUND');
      }

      // If ADVOGADO_MEMBRO, check ownership via processo
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        expense.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      return ok(expense);
    } catch (error) {
      return err('Failed to fetch expense', 'EXPENSE_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateExpenseDto,
  ): Promise<Result<any>> {
    try {
      // Verify processo exists and belongs to gabinete
      const processo = await this.prisma.processo.findFirst({
        where: {
          id: dto.processoId,
          gabineteId,
          deletedAt: null,
        },
      });

      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Create expense
      const expense = await this.expensesRepository.create({
        ...dto,
        date: new Date(dto.date),
        gabineteId,
        userId,
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.DOCUMENT,
        entityId: expense.id,
        userId,
        gabineteId,
        newValue: {
          processoId: expense.processoId,
          category: expense.category,
          amount: expense.amount,
        },
      });

      return ok(expense);
    } catch (error) {
      return err('Failed to create expense', 'EXPENSE_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Result<any>> {
    try {
      // Check expense exists
      const existing = await this.expensesRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Expense not found', 'EXPENSE_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Update
      const updateData: any = { ...dto };
      if (dto.date) {
        updateData.date = new Date(dto.date);
      }

      const expense = await this.expensesRepository.update(
        gabineteId,
        id,
        updateData,
      );
      if (!expense) {
        return err('Expense not found after update', 'EXPENSE_NOT_FOUND');
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.DOCUMENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { amount: existing.amount },
        newValue: { amount: expense.amount },
      });

      return ok(expense);
    } catch (error) {
      return err('Failed to update expense', 'EXPENSE_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.expensesRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Expense not found', 'EXPENSE_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.expensesRepository.softDelete(gabineteId, id);

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.DOCUMENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: {
          processoId: existing.processoId,
          amount: existing.amount,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete expense', 'EXPENSE_DELETE_FAILED');
    }
  }
}
