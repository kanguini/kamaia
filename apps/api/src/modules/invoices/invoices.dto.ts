import { z } from 'zod';

export const listInvoicesSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  status: z
    .enum(['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID'])
    .optional(),
  clienteId: z.string().uuid().optional(),
  processoId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const previewDraftSchema = z.object({
  clienteId: z.string().uuid(),
  processoId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  defaultHourlyRate: z.number().int().min(0).optional(),
});

export const createInvoiceSchema = z.object({
  clienteId: z.string().uuid(),
  processoId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  taxRate: z.number().min(0).max(500).optional(),
  notes: z.string().optional().nullable(),
  termsText: z.string().optional().nullable(),
  timeEntryIds: z.array(z.string().uuid()).optional(),
  expenseIds: z.array(z.string().uuid()).optional(),
  customItems: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().min(0),
        unitPrice: z.number().int().min(0),
      }),
    )
    .optional(),
  defaultHourlyRate: z.number().int().min(0).optional(),
});

export const updateInvoiceSchema = z.object({
  dueDate: z.string().datetime().optional().nullable(),
  taxRate: z.number().min(0).max(500).optional(),
  notes: z.string().optional().nullable(),
  termsText: z.string().optional().nullable(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().int().min(1),
  paidAt: z.string().datetime().optional(),
  method: z.enum(['TRANSFERENCIA', 'DINHEIRO', 'CHEQUE', 'OUTRO']).optional(),
  reference: z.string().max(120).optional(),
  notes: z.string().optional(),
});

export type ListInvoicesDto = z.infer<typeof listInvoicesSchema>;
export type PreviewDraftDto = z.infer<typeof previewDraftSchema>;
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof updateInvoiceSchema>;
export type RecordPaymentDto = z.infer<typeof recordPaymentSchema>;
