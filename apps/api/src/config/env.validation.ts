import { z } from 'zod';

/**
 * Validação de env no ARRANQUE (auditoria): sem isto, DATABASE_URL /
 * JWT_SECRET / FRONTEND_URL ausentes deixavam a API arrancar em estado
 * inválido e falhar só ao primeiro uso — p.ex. FRONTEND_URL em falta
 * caía no default localhost e o CORS bloqueava 100% do frontend
 * ("app em branco após login").
 *
 * Produção: hard-fail nas críticas. Dev/test: só avisa (o fallback de
 * dev cobre). Opcionais (ANTHROPIC_API_KEY, REDIS_URL, OPENAI_API_KEY,
 * RESEND_API_KEY…) ficam de fora — os módulos degradam graciosamente
 * e anunciam-no nos próprios logs.
 */
const ProdEnvSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL é obrigatória em produção.' })
    .min(10, 'DATABASE_URL demasiado curta — connection string inválida.'),
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET é obrigatória em produção.' })
    .min(32, 'JWT_SECRET tem de ter ≥32 chars.'),
  FRONTEND_URL: z
    .string({
      required_error:
        'FRONTEND_URL é obrigatória em produção (origens CORS). Sem ela o frontend fica 100% bloqueado.',
    })
    .min(4),
});

export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  if (env.NODE_ENV !== 'production') return env;
  const r = ProdEnvSchema.safeParse(env);
  if (!r.success) {
    const detalhes = r.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuração de produção inválida — a API não arranca em estado quebrado:\n${detalhes}`,
    );
  }
  return env;
}
