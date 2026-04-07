import { z } from 'zod';

export const createClienteSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  type: z.enum(['INDIVIDUAL', 'EMPRESA']),
  nif: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClienteSchema = createClienteSchema.partial();

export const listClientesSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['INDIVIDUAL', 'EMPRESA']).optional(),
  search: z.string().optional(),
});

export type CreateClienteDto = z.infer<typeof createClienteSchema>;
export type UpdateClienteDto = z.infer<typeof updateClienteSchema>;
export type ListClientesDto = z.infer<typeof listClientesSchema>;
