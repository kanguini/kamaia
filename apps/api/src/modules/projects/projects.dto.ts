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
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime(),
  progress: z.number().int().min(0).max(100).optional(),
  dependsOnId: z.string().uuid().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().extend({
  completedAt: z.string().datetime().optional().nullable(),
});

export const fromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(300),
  clienteId: z.string().uuid().optional().nullable(),
  startDate: z.string().datetime().optional(),
  budgetAmount: z.number().int().min(0).optional(),
});

// ── Custom templates (editable per gabinete) ──────────────

const milestoneJsonSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional().nullable(),
  startDayOffset: z.number().int().min(0),
  dueDayOffset: z.number().int().min(0),
});

export const createCustomTemplateSchema = z.object({
  category: z.enum([
    'LITIGIO',
    'MA',
    'COMPLIANCE',
    'DUE_DILIGENCE',
    'CONTRATO',
    'CONSULTORIA',
    'OUTRO',
  ]),
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  scopeBlurb: z.string().optional().nullable(),
  objectivesBlurb: z.string().optional().nullable(),
  defaultDurationDays: z.number().int().min(1).max(3650),
  milestones: z.array(milestoneJsonSchema).min(1),
  basedOnSystemId: z.string().max(60).optional().nullable(),
});

export const updateCustomTemplateSchema = createCustomTemplateSchema.partial();

export const duplicateSystemTemplateSchema = z.object({
  systemId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
});

// ── Status reports ────────────────────────────────────────

const riskSchema = z.object({
  title: z.string().min(1).max(300),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  mitigation: z.string().optional().nullable(),
});

export const generateReportSchema = z.object({
  weekStart: z.string().datetime().optional(),
  summary: z.string().optional().nullable(),
  risks: z.array(riskSchema).optional(),
  healthStatus: z.enum(['GREEN', 'YELLOW', 'RED']).optional(),
});

export const updateReportSchema = z.object({
  healthStatus: z.enum(['GREEN', 'YELLOW', 'RED']).optional(),
  summary: z.string().optional().nullable(),
  risks: z.array(riskSchema).optional().nullable(),
});

export type GenerateReportDto = z.infer<typeof generateReportSchema>;
export type UpdateReportDto = z.infer<typeof updateReportSchema>;

export type FromTemplateDto = z.infer<typeof fromTemplateSchema>;
export type CreateCustomTemplateDto = z.infer<typeof createCustomTemplateSchema>;
export type UpdateCustomTemplateDto = z.infer<typeof updateCustomTemplateSchema>;
export type DuplicateSystemTemplateDto = z.infer<typeof duplicateSystemTemplateSchema>;

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
export type CreateMilestoneDto = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneDto = z.infer<typeof updateMilestoneSchema>;
