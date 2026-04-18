import { z } from 'zod';

export const stageSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Key must be lowercase alphanumeric with hyphens'),
  label: z.string().min(1).max(100),
  position: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  category: z.string().max(60).optional().nullable(),
  slaHours: z.number().int().min(1).optional().nullable(),
  allowsParallel: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  scope: z.enum(['PROCESSO', 'PROJECT']),
  appliesTo: z.array(z.string()).default([]),
  isDefault: z.boolean().optional(),
  stages: z.array(stageSchema).min(1, 'At least one stage is required'),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  appliesTo: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const upsertStageSchema = stageSchema;

export const reorderStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()).min(1),
});

export const listWorkflowsSchema = z.object({
  scope: z.enum(['PROCESSO', 'PROJECT']).optional(),
  appliesTo: z.string().optional(),
  includeArchived: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional(),
});

export type CreateWorkflowDto = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDto = z.infer<typeof updateWorkflowSchema>;
export type UpsertStageDto = z.infer<typeof upsertStageSchema>;
export type ReorderStagesDto = z.infer<typeof reorderStagesSchema>;
export type ListWorkflowsDto = z.infer<typeof listWorkflowsSchema>;
