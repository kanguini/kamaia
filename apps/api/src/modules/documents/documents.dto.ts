import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  contratoId: z.string().uuid().optional(),
  nome: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(120),
  tamanhoBytes: z.coerce.number().int().nonnegative(),
  hashSHA256: z.string().length(64).optional(),
  // base64-encoded body for stub upload. Em produção, este endpoint
  // deve receber multipart/form-data via Multer.
  contentBase64: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDocumentDto = z.infer<typeof CreateDocumentSchema>;

export const ListDocumentsQuerySchema = z.object({
  contratoId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;
