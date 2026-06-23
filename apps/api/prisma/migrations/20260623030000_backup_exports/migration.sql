-- CreateTable
CREATE TABLE "backup_exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "size_bytes" BIGINT,
    "manifest" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "backup_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_exports_tenant_id_started_at_idx" ON "backup_exports"("tenant_id", "started_at");

-- AddForeignKey
ALTER TABLE "backup_exports"
  ADD CONSTRAINT "backup_exports_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
