import { z } from 'zod';
import { TimeEntryCategory } from '@kamaia/shared-types';

export const createTimeEntrySchema = z.object({
  processoId: z.string().uuid('Processo obrigatorio'),
  category: z.nativeEnum(TimeEntryCategory),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  durationMinutes: z.number().int().min(1, 'Minimo 1 minuto').max(1440, 'Maximo 24 horas'),
  billable: z.boolean().default(true),
});

export const updateTimeEntrySchema = createTimeEntrySchema.partial().omit({ processoId: true });

export const listTimeEntriesSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  processoId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  category: z.nativeEnum(TimeEntryCategory).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type CreateTimeEntryDto = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryDto = z.infer<typeof updateTimeEntrySchema>;
export type ListTimeEntriesDto = z.infer<typeof listTimeEntriesSchema>;
