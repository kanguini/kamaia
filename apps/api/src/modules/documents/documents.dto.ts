import { z } from 'zod';

// AUDIT fix #1: contentBase64 sem limite era vector de OOM. 50 MB
// decoded é mais que o suficiente para PDFs/Word; o frontend
// DocumentDropzone já enforça 5-15 MB. A regra `refine` verifica o
// tamanho real do payload decodificado (≈ length * 0.75) sem alocar
// um Buffer (Buffer.byteLength funciona em string base64 directo).
const MAX_BASE64_DECODED_BYTES = 50_000_000;

export const CreateDocumentSchema = z.object({
  contratoId: z.string().uuid().optional(),
  nome: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(120),
  tamanhoBytes: z.coerce.number().int().nonnegative().max(MAX_BASE64_DECODED_BYTES),
  hashSHA256: z.string().length(64).optional(),
  contentBase64: z
    .string()
    .min(1)
    .max(MAX_BASE64_DECODED_BYTES * 1.4) // base64 inflation ratio ~33%
    .refine(
      (b) => Buffer.byteLength(b, 'base64') <= MAX_BASE64_DECODED_BYTES,
      `Conteúdo decodificado excede limite de ${MAX_BASE64_DECODED_BYTES / 1_000_000} MB`,
    ),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDocumentDto = z.infer<typeof CreateDocumentSchema>;

export const ListDocumentsQuerySchema = z.object({
  contratoId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;
