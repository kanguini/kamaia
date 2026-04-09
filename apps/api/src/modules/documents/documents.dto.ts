import { z } from 'zod';
import { DocumentCategory } from '@kamaia/shared-types';

export const uploadDocumentSchema = z.object({
  title: z.string().min(1, 'Titulo obrigatorio'),
  category: z.nativeEnum(DocumentCategory),
  processoId: z.string().uuid().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.nativeEnum(DocumentCategory).optional(),
});

export const listDocumentsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.nativeEnum(DocumentCategory).optional(),
  processoId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type UploadDocumentDto = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsDto = z.infer<typeof listDocumentsSchema>;
