import { z } from 'zod';

const category = z.enum([
  'LITIGIO',
  'MA',
  'COMPLIANCE',
  'DUE_DILIGENCE',
  'CONTRATO',
  'CONSULTORIA',
  'OUTRO',
]);

const status = z.enum(['PROPOSTA', 'ACTIVO', 'EM_PAUSA', 'CONCLUIDO', 'CANCELADO']);
const health = z.enum(['GREEN', 'YELLOW', 'RED']);
const raci = z.enum(['RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED']);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(300),
  code: z.string().min(1).max(30).optional(), // auto-generated if absent
  category,
  clienteId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional(), // defaults to current user
  sponsorId: z.string().uuid().optional().nullable(),
  workflowId: z.string().uuid().optional().nullable(),
  status: status.optional(),
  healthStatus: health.optional(),
  scope: z.string().optional().nullable(),
  objectives: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  budgetAmount: z.number().int().min(0).optional().nullable(),
  budgetCurrency: z.string().length(3).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({
    actualEndDate: z.string().datetime().optional().nullable(),
    risksJson: z.record(z.unknown()).optional().nullable(),
  });

export const listProjectsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: status.optional(),
  category: category.optional(),
  managerId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: raci,
  allocationPct: z.number().int().min(1).max(100).optional(),
  hourlyRate: z.number().int().min(0).optional(),
});

export const updateMemberSchema = addMemberSchema.partial().omit({ userId: true });

export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
  dependsOnId: z.string().uuid().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().extend({
  completedAt: z.string().datetime().optional().nullable(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
export type CreateMilestoneDto = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneDto = z.infer<typeof updateMilestoneSchema>;
