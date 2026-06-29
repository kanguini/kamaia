import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  // Onboarding: cria o primeiro Tenant + Membership ADMIN ao registar
  tenantName: z.string().min(2).max(200),
  tenantNif: z.string().max(20).optional(),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  // "Confiar neste dispositivo" — sessão mais longa (30d vs 7d).
  lembrar: z.coerce.boolean().optional().default(false),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshSchema>;
