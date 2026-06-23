-- Adiciona soft-delete a Template (regra CLAUDE.md: nunca DELETE
-- físico em dados de negócio). isActive era apenas flag de
-- visibilidade; deletedAt distingue archived de deleted.
ALTER TABLE "templates"
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

CREATE INDEX "templates_tenant_id_deleted_at_idx"
  ON "templates"("tenant_id", "deleted_at");
