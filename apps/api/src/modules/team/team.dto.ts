import { z } from 'zod';
import { KamaiaRole } from '@kamaia/shared-types';

const roleValues = Object.values(KamaiaRole) as [string, ...string[]];

export const inviteMemberSchema = z.object({
  email: z.string().email('Email inválido').max(200),
  firstName: z.string().min(1, 'Primeiro nome obrigatório').max(100),
  lastName: z.string().min(1, 'Apelido obrigatório').max(100),
  role: z.enum(roleValues),
  oaaNumber: z.string().max(30).optional(),
  specialty: z.string().max(100).optional(),
});

export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(roleValues).optional(),
  isActive: z.boolean().optional(),
  specialty: z.string().max(100).optional(),
  oaaNumber: z.string().max(30).optional(),
});

export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
