import { z } from 'zod';

// ── Create Conversation ───────────────────────────────────

export const createConversationSchema = z.object({
  title: z.string().max(300).optional(),
  context: z.enum(['GERAL', 'PROCESSO', 'PRAZO', 'DOCUMENTO']).default('GERAL'),
  contextId: z.string().uuid().optional(),
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;

// ── Send Message ──────────────────────────────────────────

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem obrigatoria').max(5000, 'Mensagem muito longa'),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

// ── List Conversations ────────────────────────────────────

export const listConversationsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export type ListConversationsDto = z.infer<typeof listConversationsSchema>;
