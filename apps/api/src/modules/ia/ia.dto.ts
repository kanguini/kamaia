import { z } from 'zod';

export const CreateConversationSchema = z.object({
  // O frontend cria a conversa "preguiçosa" (sem título — só ao escrever a
  // 1ª mensagem). Sem default, o corpo vazio `{}` dava 400 e o chat não
  // arrancava. Default garante criação válida; o título real vem depois.
  titulo: z.string().min(2).max(200).default('Nova conversa'),
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
