import { z } from 'zod';

// ── Column DTOs ──────────────────────────────────────────

export const createColumnSchema = z.object({
  title: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
export type CreateColumnDto = z.infer<typeof createColumnSchema>;

export const updateColumnSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});
export type UpdateColumnDto = z.infer<typeof updateColumnSchema>;

export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string().uuid()),
});
export type ReorderColumnsDto = z.infer<typeof reorderColumnsSchema>;

// ── Task DTOs ────────────────────────────────────────────

export const createTaskSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['ALTA', 'MEDIA', 'BAIXA']).default('MEDIA'),
  assigneeId: z.string().uuid().optional().nullable(),
  processoId: z.string().uuid().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labels: z.array(z.string()).optional(),
});
export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  title: z.string().min(1).max(500).optional(),
});
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  columnId: z.string().uuid(),
  position: z.number().int().min(0),
});
export type MoveTaskDto = z.infer<typeof moveTaskSchema>;

// ── Checklist DTOs ───────────────────────────────────────

export const createCheckItemSchema = z.object({
  title: z.string().min(1).max(300),
});
export type CreateCheckItemDto = z.infer<typeof createCheckItemSchema>;

export const updateCheckItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  checked: z.boolean().optional(),
});
export type UpdateCheckItemDto = z.infer<typeof updateCheckItemSchema>;

// ── Comment DTOs ─────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1),
});
export type CreateCommentDto = z.infer<typeof createCommentSchema>;
