import { z } from 'zod';

export const CreateConversationSchema = z.object({
  titulo: z.string().min(2).max(200),
  contexto: z.record(z.string(), z.unknown()).optional(),
});
export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const ListConversationsQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

export const SendMessageSchema = z.object({
  conteudo: z.string().min(1).max(8000),
});
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
