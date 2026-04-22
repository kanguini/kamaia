import { z } from 'zod';

export const createPublicContactSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(200),
  email: z.string().email('Email inválido').max(255),
  phone: z.string().max(50).optional().or(z.literal('')),
  gabinete: z.string().max(200).optional().or(z.literal('')),
  plan: z.string().max(50).optional().or(z.literal('')),
  message: z.string().min(10, 'Escreve pelo menos 10 caracteres').max(5000),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consentimento obrigatório' }),
  }),
  turnstileToken: z.string().min(1, 'Verificação anti-bot obrigatória'),
});

export type CreatePublicContactDto = z.infer<typeof createPublicContactSchema>;
