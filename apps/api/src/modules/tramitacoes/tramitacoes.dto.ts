import { z } from 'zod';
import { TramitacaoAutor, PrazoType } from '@kamaia/shared-types';

// Acto processual registado pelo advogado. Pode gerar automaticamente
// um Prazo e/ou avançar a fase do processo via `generatePrazo` e
// `advanceToStage`.
export const createTramitacaoSchema = z.object({
  processoId: z.string().uuid('Processo obrigatório'),
  autor: z.nativeEnum(TramitacaoAutor),
  actoType: z.string().min(1).max(60), // key de ActoTypeDefinition
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  actoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  metadata: z.record(z.any()).optional(),
  // Automações opcionais
  generatePrazo: z
    .object({
      type: z.nativeEnum(PrazoType),
      title: z.string().min(1),
      daysAfter: z.number().int().min(1).max(365),
      alertHoursBefore: z.number().int().min(1).default(48),
    })
    .optional(),
  advanceToStage: z.string().max(100).optional(),
});

export const registerFromTemplateSchema = z.object({
  processoId: z.string().uuid('Processo obrigatório'),
  templateKey: z.string().min(1),
  actoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  // Overrides opcionais sobre o template
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateTramitacaoSchema = z.object({
  autor: z.nativeEnum(TramitacaoAutor).optional(),
  actoType: z.string().min(1).max(60).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  actoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metadata: z.record(z.any()).optional(),
});

export const listTramitacoesSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  processoId: z.string().uuid().optional(),
  autor: z.nativeEnum(TramitacaoAutor).optional(),
  actoType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type CreateTramitacaoDto = z.infer<typeof createTramitacaoSchema>;
export type RegisterFromTemplateDto = z.infer<typeof registerFromTemplateSchema>;
export type UpdateTramitacaoDto = z.infer<typeof updateTramitacaoSchema>;
export type ListTramitacoesDto = z.infer<typeof listTramitacoesSchema>;
