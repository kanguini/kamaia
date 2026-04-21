import { z } from 'zod';

export const createCheckoutSchema = z.object({
  plan: z.enum(['PRO_INDIVIDUAL', 'PRO_BUSINESS']),
  successUrl: z.string().url('successUrl inválido'),
  cancelUrl: z.string().url('cancelUrl inválido'),
});

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;

export const portalSessionSchema = z.object({
  returnUrl: z.string().url('returnUrl inválido'),
});

export type PortalSessionDto = z.infer<typeof portalSessionSchema>;
