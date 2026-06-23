import { z } from 'zod';

/**
 * Schema do payload de restore. Aceita o dump produzido por
 * `generateDump()` com:
 *  - `meta.format === 'kamaia-clm-backup'`
 *  - `meta.version` compatível (`1.x`)
 *  - `payload` com as colecções de entidades
 *
 * `tenantId` original no backup é ignorado — restauramos sempre
 * para o tenant activo do actor. O `tenantId` em cada entidade é
 * reescrito para o target. Memberships e auditLogs são ignorados
 * por segurança (não tocar em acesso nem reescrever histórico).
 */

const META_SCHEMA = z.object({
  format: z.literal('kamaia-clm-backup'),
  version: z.string().regex(/^1\.\d+$/, 'Versão de backup não suportada'),
  generatedAt: z.string(),
  tenantId: z.string().uuid().optional(),
});

const ENTITY_ARRAY = z.array(z.record(z.any()));

export const RestoreBackupSchema = z.object({
  /**
   * `true` (default): apenas valida o payload e devolve um manifest
   * com contagens — sem escrita. `false`: escreve no DB. O default
   * é dry-run para evitar restores acidentais.
   */
  dryRun: z.boolean().default(true),

  /**
   * Política de colisão de ID:
   *  - `skip` (default): mantém row existente, ignora a do backup
   *  - `error`: aborta se encontrar qualquer colisão
   *
   * Não oferecemos `overwrite` no MVP — restaurar por cima de dados
   * activos pode partir referências e histórico.
   */
  collisionPolicy: z.enum(['skip', 'error']).default('skip'),

  /** O dump completo, exactamente como exportado. */
  backup: z.object({
    summary: z.record(z.any()).optional(),
    meta: META_SCHEMA.optional(),
    payload: z
      .object({
        meta: META_SCHEMA,
        tenant: z.record(z.any()).nullable().optional(),
        entidades: ENTITY_ARRAY.optional(),
        carteiras: ENTITY_ARRAY.optional(),
        tiposCustom: ENTITY_ARRAY.optional(),
        templates: ENTITY_ARRAY.optional(),
        clausulas: ENTITY_ARRAY.optional(),
        contratos: ENTITY_ARRAY.optional(),
        versoes: ENTITY_ARRAY.optional(),
        partes: ENTITY_ARRAY.optional(),
        datasChave: ENTITY_ARRAY.optional(),
        obrigacoes: ENTITY_ARRAY.optional(),
        actosRegulatorios: ENTITY_ARRAY.optional(),
        negociacaoPontos: ENTITY_ARRAY.optional(),
        eventos: ENTITY_ARRAY.optional(),
        terminacoes: ENTITY_ARRAY.optional(),
        documents: ENTITY_ARRAY.optional(),
      })
      .optional(),
  }),
});

export type RestoreBackupDto = z.infer<typeof RestoreBackupSchema>;

export interface RestoreManifest {
  /** Colecções com contagens a importar / saltar / colidir. */
  collections: Record<
    string,
    {
      inBackup: number;
      toCreate: number;
      collisions: number;
      skipped: number;
    }
  >;
  /** Ids que colidiram com rows existentes no target tenant. */
  collisionIds: { collection: string; id: string }[];
  /** Soma total inserida (zero em dry-run). */
  totalWritten: number;
  /** Versão do backup. */
  backupVersion: string;
  /** Tenant de origem (informativo). */
  sourceTenantId: string | null;
  /** Tenant de destino. */
  targetTenantId: string;
}
