import { z } from 'zod';
import { ExpenseCategory } from '@kamaia/shared-types';

export const createExpenseSchema = z.object({
  processoId: z.string().uuid('Processo obrigatorio'),
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().min(1, 'Descricao obrigatoria'),
  amount: z.number().int().min(1, 'Valor obrigatorio'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
});

export const updateExpenseSchema = createExpenseSchema.partial().omit({ processoId: true });

export const listExpensesSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  processoId: z.string().uuid().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;
export type ListExpensesDto = z.infer<typeof listExpensesSchema>;
