-- Adiciona discriminador export/restore ao histórico de backups.
ALTER TABLE "backup_exports"
  ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'export';

CREATE INDEX "backup_exports_tenant_id_type_started_at_idx"
  ON "backup_exports"("tenant_id", "type", "started_at");
