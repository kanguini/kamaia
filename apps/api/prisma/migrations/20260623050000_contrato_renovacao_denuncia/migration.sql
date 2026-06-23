-- Adiciona campos para renovação automática real e registo de denúncia tempestiva.
ALTER TABLE "contratos"
  ADD COLUMN "prazo_renovacao_meses" INTEGER,
  ADD COLUMN "denuncia_em" TIMESTAMPTZ,
  ADD COLUMN "denuncia_por_user_id" UUID,
  ADD COLUMN "denuncia_motivo" TEXT;

-- Índice para scanner do motor de renovação (procura contratos com termo
-- próximo, com renovação automática activa, e sem denúncia).
CREATE INDEX "contratos_renovacao_scan_idx"
  ON "contratos"("tenant_id", "estado", "data_termo")
  WHERE "renovacao_automatica" = TRUE AND "denuncia_em" IS NULL;
