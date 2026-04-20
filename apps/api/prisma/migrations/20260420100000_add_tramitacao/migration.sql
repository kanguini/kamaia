-- Tramitação: acto processual registado pelo advogado.
-- Distinto de ProcessoEvent (audit trail automático do sistema).

-- CreateTable
CREATE TABLE "tramitacoes" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "autor" VARCHAR(30) NOT NULL,
    "acto_type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "acto_date" DATE NOT NULL,
    "generated_prazo_id" UUID,
    "advanced_to_stage" VARCHAR(100),
    "metadata" JSONB,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tramitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tramitacao_processo_date" ON "tramitacoes"("gabinete_id", "processo_id", "acto_date");
CREATE INDEX "idx_tramitacao_processo_autor" ON "tramitacoes"("processo_id", "autor");
CREATE INDEX "idx_tramitacao_processo_type" ON "tramitacoes"("processo_id", "acto_type");

-- AddForeignKey
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tramitacoes" ADD CONSTRAINT "tramitacoes_generated_prazo_id_fkey" FOREIGN KEY ("generated_prazo_id") REFERENCES "prazos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
