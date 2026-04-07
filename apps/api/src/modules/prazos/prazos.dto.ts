import { z } from 'zod';
import { PrazoType, PrazoStatus } from '@kamaia/shared-types';

export const createPrazoSchema = z.object({
  processoId: z.string().uuid('Processo obrigatorio'),
  title: z.string().min(1, 'Titulo obrigatorio'),
  description: z.string().optional(),
  type: z.nativeEnum(PrazoType),
  dueDate: z.string().datetime({ message: 'Data limite obrigatoria' }),
  alertHoursBefore: z.number().int().min(1).default(48),
  isUrgent: z.boolean().default(false),
});

export const updatePrazoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.nativeEnum(PrazoType).optional(),
  dueDate: z.string().datetime().optional(),
  alertHoursBefore: z.number().int().min(1).optional(),
  isUrgent: z.boolean().optional(),
});

export const changeStatusSchema = z.object({
  status: z.nativeEnum(PrazoStatus),
});

export const listPrazosSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PrazoStatus).optional(),
  processoId: z.string().uuid().optional(),
  type: z.nativeEnum(PrazoType).optional(),
  isUrgent: z.coerce.boolean().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
});

export const suggestPrazoSchema = z.object({
  eventType: z.enum(['CITACAO_CIVEL', 'SENTENCA_CIVEL', 'DESPEDIMENTO_LABORAL', 'DECISAO_ARBITRAL']),
  eventDate: z.string().datetime(),
});

export type CreatePrazoDto = z.infer<typeof createPrazoSchema>;
export type UpdatePrazoDto = z.infer<typeof updatePrazoSchema>;
export type ChangeStatusDto = z.infer<typeof changeStatusSchema>;
export type ListPrazosDto = z.infer<typeof listPrazosSchema>;
export type SuggestPrazoDto = z.infer<typeof suggestPrazoSchema>;
