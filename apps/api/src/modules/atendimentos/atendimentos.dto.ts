import { z } from 'zod';

const statusValues = [
  'NOVO',
  'EM_ANALISE',
  'QUALIFICADO',
  'CONVERTIDO',
  'PERDIDO',
] as const;

const sourceValues = [
  'WHATSAPP',
  'EMAIL',
  'TELEFONE',
  'REFERENCIA',
  'PRESENCIAL',
  'WEBSITE',
  'OUTRO',
] as const;

const priorityValues = ['ALTA', 'MEDIA', 'BAIXA'] as const;

export const createAtendimentoSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['INDIVIDUAL', 'EMPRESA']),
  nif: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  subject: z.string().min(1, 'Assunto é obrigatório').max(500),
  description: z.string().optional(),
  source: z.enum(sourceValues),
  priority: z.enum(priorityValues).default('MEDIA'),
  notes: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
});

/**
 * Update accepts everything in create, plus status + lostReason.
 * The server still enforces state-machine transitions.
 */
export const updateAtendimentoSchema = createAtendimentoSchema
  .partial()
  .extend({
    status: z.enum(statusValues).optional(),
    lostReason: z.string().max(300).optional(),
  });

export const listAtendimentosSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  status: z.enum(statusValues).optional(),
  source: z.enum(sourceValues).optional(),
  assignedToId: z.string().uuid().optional(),
  search: z.string().optional(),
});

/**
 * Convert payload:
 *  - cliente side: re-use existing cliente (clienteId) OR create a new one.
 *    When creating, we carry over the atendimento's contact fields but allow
 *    the user to override them at conversion time.
 *  - processo side: always creates a new processo from the provided title +
 *    type (+ optional priority/description).
 */
export const convertAtendimentoSchema = z
  .object({
    // Cliente
    clienteId: z.string().uuid().optional(),
    clienteOverride: z
      .object({
        name: z.string().min(1).optional(),
        nif: z.string().max(20).optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().max(30).optional(),
        address: z.string().optional(),
      })
      .optional(),

    // Processo
    processo: z.object({
      title: z.string().min(1, 'Título do processo é obrigatório').max(500),
      type: z.enum([
        'CIVEL',
        'LABORAL',
        'COMERCIAL',
        'CRIMINAL',
        'ADMINISTRATIVO',
        'FAMILIA',
        'ARBITRAGEM',
      ]),
      description: z.string().optional(),
      priority: z.enum(priorityValues).default('MEDIA'),
    }),
  })
  .refine((v) => v.clienteId || v.clienteOverride, {
    message: 'Informe clienteId (cliente existente) ou clienteOverride (criar novo)',
    path: ['clienteId'],
  });

export type CreateAtendimentoDto = z.infer<typeof createAtendimentoSchema>;
export type UpdateAtendimentoDto = z.infer<typeof updateAtendimentoSchema>;
export type ListAtendimentosDto = z.infer<typeof listAtendimentosSchema>;
export type ConvertAtendimentoDto = z.infer<typeof convertAtendimentoSchema>;
