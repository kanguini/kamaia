import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  oaaNumber: z.string().optional(),
  specialty: z.string().optional(),
  gabineteName: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const loginWithProviderSchema = z.object({
  provider: z.string(),
  providerId: z.string(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  avatarUrl: z.string().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type LoginWithProviderDto = z.infer<typeof loginWithProviderSchema>;
