import { z } from 'zod';

// AUDIT fix #1: contentBase64 sem limite era vector de OOM. 15 MB
// decoded alinha com o frontend (DocumentDropzone enforça 5-15 MB) e
// cabe no body limit de 25 MB do Express (15 MB × 1.37 base64 ≈ 20 MB)
// — o limite anterior de 50 MB era inatingível: morria no body-parser
// com 413 genérico antes de o Zod dar a mensagem amigável. A regra
// `refine` verifica o tamanho decodificado sem alocar um Buffer.
const MAX_BASE64_DECODED_BYTES = 15_000_000;

// Allowlist de tipos que a plataforma processa (pdf-parse, mammoth,
// tesseract). Sem isto, um cliente podia declarar `text/html`/SVG e o
// signed URL servia-o inline → XSS armazenado. Tipos fora da lista são
// rejeitados à entrada.
const MIME_TYPES_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
]);

export const CreateDocumentSchema = z.object({
  contratoId: z.string().uuid().optional(),
  nome: z.string().min(1).max(300),
  mimeType: z
    .string()
    .min(1)
    .max(120)
    .transform((m) => m.toLowerCase().split(';')[0].trim())
    .refine(
      (m) => MIME_TYPES_PERMITIDOS.has(m),
      'Tipo de ficheiro não suportado. Usa PDF, Word, Excel, CSV, texto ou imagem (PNG/JPEG/WebP/TIFF).',
    ),
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
