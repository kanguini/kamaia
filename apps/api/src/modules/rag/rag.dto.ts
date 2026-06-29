import { z } from 'zod';

export const CreateLegislationSchema = z.object({
  codigo: z.string().min(1).max(80),
  titulo: z.string().min(2).max(300),
  diploma: z.string().min(2).max(200),
  publicacao: z.coerce.date().optional(),
  emVigorDesde: z.coerce.date().optional(),
  emVigorAte: z.coerce.date().optional(),
  url: z.string().url().max(500).optional(),
  conteudo: z.string().optional(),
});
export type CreateLegislationDto = z.infer<typeof CreateLegislationSchema>;

export const ListLegislationQuerySchema = z.object({
  q: z.string().optional(),
  orgao: z.string().max(200).optional(),
  ano: z.coerce.number().int().min(1900).max(2200).optional(),
  fonte: z.enum(['CURADO', 'LEXAO']).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListLegislationQuery = z.infer<typeof ListLegislationQuerySchema>;

export const AddChunksSchema = z.object({
  chunks: z
    .array(
      z.object({
        artigo: z.string().max(40).optional(),
        trecho: z.string().min(1),
        ordem: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(500),
});
export type AddChunksDto = z.infer<typeof AddChunksSchema>;

export const SearchSchema = z.object({
  q: z.string().min(2).max(500),
  documentId: z.string().uuid().optional(),
  topK: z.coerce.number().int().min(1).max(50).default(8),
});
export type SearchDto = z.infer<typeof SearchSchema>;
