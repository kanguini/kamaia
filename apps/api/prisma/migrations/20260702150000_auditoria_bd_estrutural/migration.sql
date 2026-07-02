-- ═══════════════════════════════════════════════════════════════════
-- Auditoria Jul/2026 — Onda 5 (BD estrutural, parte segura/aditiva)
--
-- Migração escrita à mão (padrão do projecto — ver 20260628120000).
-- Conteúdo:
--   1. Tenant → tabelas de negócio: ON DELETE CASCADE → RESTRICT.
--      Um DELETE de tenant destruía fisicamente 50k contratos +
--      assinaturas com valor probatório, contornando o soft-delete.
--      A remoção de um tenant passa a exigir purge deliberado.
--   2. Índice vectorial nos chunks de legislação (HNSW; fallback
--      IVFFlat; se o pgvector não suportar nenhum, segue sem índice).
--   3. CHECKs de dinheiro (NOT VALID: só valida escritas novas — não
--      bloqueia em dados históricos).
--   4. Índices em colunas FK sem índice (deletes com seq scan).
--   5. Dedupe + unique de chunks (documentId, ordem) — reimportações
--      concorrentes podiam duplicar chunks silenciosamente.
-- ═══════════════════════════════════════════════════════════════════

-- 1 ── Tenant: CASCADE → RESTRICT ────────────────────────────────────
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_tenant_id_fkey";
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entidades" DROP CONSTRAINT "entidades_tenant_id_fkey";
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "carteiras" DROP CONSTRAINT "carteiras_tenant_id_fkey";
ALTER TABLE "carteiras" ADD CONSTRAINT "carteiras_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tipos_contrato" DROP CONSTRAINT "tipos_contrato_tenant_id_fkey";
ALTER TABLE "tipos_contrato" ADD CONSTRAINT "tipos_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "templates" DROP CONSTRAINT "templates_tenant_id_fkey";
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clausulas" DROP CONSTRAINT "clausulas_tenant_id_fkey";
ALTER TABLE "clausulas" ADD CONSTRAINT "clausulas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contratos" DROP CONSTRAINT "contratos_tenant_id_fkey";
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "importacao_lotes" DROP CONSTRAINT "importacao_lotes_tenant_id_fkey";
ALTER TABLE "importacao_lotes" ADD CONSTRAINT "importacao_lotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents" DROP CONSTRAINT "documents_tenant_id_fkey";
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "backup_exports" DROP CONSTRAINT "backup_exports_tenant_id_fkey";
ALTER TABLE "backup_exports" ADD CONSTRAINT "backup_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_conversations" DROP CONSTRAINT "ai_conversations_tenant_id_fkey";
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_tenant_id_fkey";
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "usage_quotas" DROP CONSTRAINT "usage_quotas_tenant_id_fkey";
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenant_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agenda_eventos" DROP CONSTRAINT "agenda_eventos_tenant_id_fkey";
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tarefas" DROP CONSTRAINT "tarefas_tenant_id_fkey";
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tarefa_colunas" DROP CONSTRAINT "tarefa_colunas_tenant_id_fkey";
ALTER TABLE "tarefa_colunas" ADD CONSTRAINT "tarefa_colunas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_tenant_id_fkey";
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_tenant_id_fkey";
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2 ── Índice vectorial (RAG) ────────────────────────────────────────
-- Sem índice, cada pesquisa do Dr. Kamaia faz seq scan + distância em
-- todos os chunks. HNSW (pgvector ≥0.5) → IVFFlat → sem índice, nunca
-- falhando a migração (o fallback textual continua a funcionar).
DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS "legislation_chunks_embedding_hnsw_idx"
      ON "legislation_chunks" USING hnsw ("embedding" vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS "legislation_chunks_embedding_ivfflat_idx"
        ON "legislation_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pgvector sem suporte HNSW/IVFFlat — índice vectorial não criado.';
    END;
  END;
END $$;

-- 3 ── CHECKs de dinheiro (NOT VALID: não bloqueia dados históricos) ─
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_valor_nao_negativo"
  CHECK ("valor" IS NULL OR "valor" >= 0) NOT VALID;
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_valor_em_akz_nao_negativo"
  CHECK ("valor_em_akz" IS NULL OR "valor_em_akz" >= 0) NOT VALID;
ALTER TABLE "contrato_actos_regulatorios" ADD CONSTRAINT "actos_base_tributavel_nao_negativa"
  CHECK ("base_tributavel" IS NULL OR "base_tributavel" >= 0) NOT VALID;
ALTER TABLE "contrato_actos_regulatorios" ADD CONSTRAINT "actos_valor_liquidar_nao_negativo"
  CHECK ("valor_liquidar" IS NULL OR "valor_liquidar" >= 0) NOT VALID;
ALTER TABLE "usage_quotas" ADD CONSTRAINT "quotas_usados_nao_negativos"
  CHECK (
    "contratos_usado" >= 0 AND "utilizadores_usado" >= 0 AND
    "storage_bytes_usado" >= 0 AND "ia_messages_usado" >= 0 AND
    "ai_credits_usado" >= 0
  ) NOT VALID;

-- 4 ── Índices em colunas FK sem índice (Postgres não indexa FKs) ────
CREATE INDEX IF NOT EXISTS "contrato_obrigacoes_parte_responsavel_id_idx"
  ON "contrato_obrigacoes"("parte_responsavel_id");
CREATE INDEX IF NOT EXISTS "contrato_comentarios_parent_comentario_id_idx"
  ON "contrato_comentarios"("parent_comentario_id");
CREATE INDEX IF NOT EXISTS "contrato_comentarios_autor_colaborador_id_idx"
  ON "contrato_comentarios"("autor_colaborador_id");
CREATE INDEX IF NOT EXISTS "contrato_assinaturas_colaborador_id_idx"
  ON "contrato_assinaturas"("colaborador_id");
CREATE INDEX IF NOT EXISTS "templates_tipo_id_idx"
  ON "templates"("tipo_id");

-- 5 ── Chunks: dedupe + unicidade (documentId, ordem) ────────────────
-- Remove duplicados (mantém o mais antigo) antes de criar o unique.
DELETE FROM "legislation_chunks" a
  USING "legislation_chunks" b
  WHERE a."document_id" = b."document_id"
    AND a."ordem" = b."ordem"
    AND a."id" > b."id";
CREATE UNIQUE INDEX IF NOT EXISTS "legislation_chunks_document_id_ordem_key"
  ON "legislation_chunks"("document_id", "ordem");
