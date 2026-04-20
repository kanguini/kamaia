import { z } from 'zod';
import { ProcessoType, ProcessoStatus, ProcessoEventType } from '@kamaia/shared-types';

export const createProcessoSchema = z.object({
  title: z.string().min(1, 'Titulo obrigatorio'),
  type: z.nativeEnum(ProcessoType),
  clienteId: z.string().uuid('Cliente obrigatorio'),
  description: z.string().optional(),
  court: z.string().optional(),
  courtCaseNumber: z.string().optional(),
  judge: z.string().optional(),
  opposingParty: z.string().optional(),
  opposingLawyer: z.string().optional(),
  priority: z.enum(['ALTA', 'MEDIA', 'BAIXA']).default('MEDIA'),
  feeType: z.enum(['FIXO', 'HORA', 'PERCENTAGEM', 'PRO_BONO']).optional(),
  feeAmount: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  strategy: z.string().optional(),
});

export const updateProcessoSchema = createProcessoSchema
  .partial()
  .omit({ type: true, clienteId: true });

// Edição dedicada da estratégia — endpoint separado para audit
// trail granular (a estratégia evolui ao longo do processo).
export const updateStrategySchema = z.object({
  strategy: z.string().max(20000, 'Estratégia excede 20 000 caracteres'),
});
export type UpdateStrategyDto = z.infer<typeof updateStrategySchema>;

export const changeStageSchema = z.object({
  stage: z.string().min(1),
});

export const changeStatusSchema = z.object({
  status: z.nativeEnum(ProcessoStatus),
});

export const createEventSchema = z.object({
  type: z.nativeEnum(ProcessoEventType),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const listProcessosSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  status: z.nativeEnum(ProcessoStatus).optional(),
  type: z.nativeEnum(ProcessoType).optional(),
  advogadoId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  priority: z.enum(['ALTA', 'MEDIA', 'BAIXA']).optional(),
  search: z.string().optional(),
});

export const listEventsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
});

export type CreateProcessoDto = z.infer<typeof createProcessoSchema>;
export type UpdateProcessoDto = z.infer<typeof updateProcessoSchema>;
export type ChangeStageDto = z.infer<typeof changeStageSchema>;
export type ChangeStatusDto = z.infer<typeof changeStatusSchema>;
export type CreateEventDto = z.infer<typeof createEventSchema>;
export type ListProcessosDto = z.infer<typeof listProcessosSchema>;
export type ListEventsDto = z.infer<typeof listEventsSchema>;
