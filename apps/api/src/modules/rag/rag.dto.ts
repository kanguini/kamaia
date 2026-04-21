import { z } from 'zod';
import { LegislationCategory } from '@kamaia/shared-types';

const legislationCategoryValues = Object.values(LegislationCategory) as [
  string,
  ...string[],
];

/**
 * Ingestão de texto — usado por endpoints admin para carregar legislação
 * directamente como string (sem PDF). Tudo parametrizado; não vai nada
 * para SQL concatenado — mas validamos limites para prevenir payloads
 * abusivos e erros de negócio (títulos vazios, strings infinitas, etc.).
 */
export const ingestTextSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(500),
  shortName: z.string().min(1, 'Nome curto é obrigatório').max(100),
  reference: z.string().min(1, 'Referência é obrigatória').max(100),
  category: z.enum(legislationCategoryValues),
  content: z.string().min(10, 'Conteúdo muito curto').max(2_000_000),
  sourceUrl: z.string().url().optional(),
});

export type IngestTextDto = z.infer<typeof ingestTextSchema>;

/**
 * Ingestão de PDF — metadata (o ficheiro em si vem como multipart e é
 * validado pelo FileInterceptor). Categoria opcional com fallback.
 */
export const ingestPdfMetadataSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(500),
  shortName: z.string().min(1, 'Nome curto é obrigatório').max(100),
  reference: z.string().min(1, 'Referência é obrigatória').max(100),
  category: z.enum(legislationCategoryValues).optional(),
  sourceUrl: z.string().url().optional(),
});

export type IngestPdfMetadataDto = z.infer<typeof ingestPdfMetadataSchema>;

/**
 * Query params para pesquisa semântica — `q` obrigatório, `limit` clamp
 * para prevenir queries brutais contra pgvector.
 */
export const ragSearchSchema = z.object({
  q: z.string().min(1, 'Query é obrigatória').max(1000),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type RagSearchDto = z.infer<typeof ragSearchSchema>;
