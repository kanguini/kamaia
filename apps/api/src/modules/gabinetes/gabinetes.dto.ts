import { z } from 'zod';

export const updateGabineteSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  nif: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

export type UpdateGabineteDto = z.infer<typeof updateGabineteSchema>;
