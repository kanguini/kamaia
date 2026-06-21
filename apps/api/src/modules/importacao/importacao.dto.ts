import { LoteEstado } from '@kamaia/shared-types';
import { z } from 'zod';

export const CreateLoteSchema = z.object({
  nome: z.string().min(2).max(200),
});
export type CreateLoteDto = z.infer<typeof CreateLoteSchema>;

export const AddLinhaSchema = z.object({
  documentId: z.string().uuid().optional(),
  metadataInput: z.record(z.string(), z.unknown()).optional(),
});
export type AddLinhaDto = z.infer<typeof AddLinhaSchema>;

export const ListLotesQuerySchema = z.object({
  estado: z.nativeEnum(LoteEstado).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListLotesQuery = z.infer<typeof ListLotesQuerySchema>;
