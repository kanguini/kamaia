import { z } from 'zod';
import { CustomFieldType } from '@prisma/client';

/**
 * DTO da criação de uma `CustomFieldDefinition`.
 *
 * `key` é a chave estável (snake-case/camelCase, alphanum + underscore).
 * `label` é o que o utilizador final vê. `hint` é opcional. `type`
 * determina como o campo é renderizado e como os valores são
 * validados.
 *
 * Para SELECT, `options` deve ser um array de strings (as opções
 * disponíveis). Para MONEY, `options` pode ter `{ moedas: [...] }`
 * para restringir códigos ISO 4217 aceites; se omitido, qualquer
 * moeda suportada serve.
 */
export const CreateCustomFieldSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
      message: 'key deve começar por letra ou _ e conter apenas alfanumérico e _',
    }),
  label: z.string().min(1).max(120),
  hint: z.string().max(400).optional(),
  type: z.nativeEnum(CustomFieldType),
  options: z
    .union([
      z.array(z.string().min(1)).min(1).max(50), // SELECT options
      z.object({}).passthrough(),                // MONEY/ADDRESS metadata
    ])
    .optional(),
  required: z.boolean().optional().default(false),
  ordem: z.number().int().min(0).optional().default(0),
});
export type CreateCustomFieldDto = z.infer<typeof CreateCustomFieldSchema>;

export const UpdateCustomFieldSchema = CreateCustomFieldSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCustomFieldDto = z.infer<typeof UpdateCustomFieldSchema>;

/**
 * Payload do upsert em massa dos valores. Aceita `Record<key, value>`
 * onde a key é a `key` da definition (não o id — assim o caller pode
 * referenciar campos por nome estável).
 *
 * Valores podem ser primitivos (string/number/boolean) ou objectos
 * estruturados (MONEY/ADDRESS). Validação por tipo é feita no service
 * antes do upsert.
 */
export const UpsertValoresSchema = z.object({
  values: z.record(z.string(), z.unknown()),
});
export type UpsertValoresDto = z.infer<typeof UpsertValoresSchema>;
