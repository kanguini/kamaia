import { z } from 'zod';
import { AudienciaType, AudienciaStatus } from '@kamaia/shared-types';

export const createAudienciaSchema = z.object({
  processoId: z.string().uuid('Processo obrigatório'),
  type: z.nativeEnum(AudienciaType),
  scheduledAt: z.string().datetime('Data/hora obrigatória (ISO)'),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  location: z.string().max(200).optional(),
  judge: z.string().max(200).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateAudienciaSchema = z.object({
  type: z.nativeEnum(AudienciaType).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  location: z.string().max(200).optional(),
  judge: z.string().max(200).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Marcar como realizada — regista data efectiva e narrativa do resultado.
export const markHeldSchema = z.object({
  heldAt: z.string().datetime().optional(), // default: now()
  outcome: z.string().min(1, 'Resultado obrigatório'),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  metadata: z.record(z.any()).optional(),
});

// Adiar — fecha a Audiência actual e abre uma nova linkada via previousId.
export const postponeSchema = z.object({
  newScheduledAt: z.string().datetime('Nova data/hora obrigatória'),
  reason: z.string().min(1, 'Motivo obrigatório'),
  location: z.string().max(200).optional(),
  judge: z.string().max(200).optional(),
  notes: z.string().optional(),
});

export const cancelSchema = z.object({
  reason: z.string().min(1, 'Motivo obrigatório'),
});

export const listAudienciasSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  processoId: z.string().uuid().optional(),
  status: z.nativeEnum(AudienciaStatus).optional(),
  type: z.nativeEnum(AudienciaType).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type CreateAudienciaDto = z.infer<typeof createAudienciaSchema>;
export type UpdateAudienciaDto = z.infer<typeof updateAudienciaSchema>;
export type MarkHeldDto = z.infer<typeof markHeldSchema>;
export type PostponeDto = z.infer<typeof postponeSchema>;
export type CancelDto = z.infer<typeof cancelSchema>;
export type ListAudienciasDto = z.infer<typeof listAudienciasSchema>;
