-- Audiência: acto judicial presencial com ciclo de vida (agendada, realizada,
-- adiada, cancelada). Cada adiamento cria uma nova linha ligada à anterior
-- via previous_id (histórico preservado).

-- CreateTable
CREATE TABLE "audiencias" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AGENDADA',
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "held_at" TIMESTAMPTZ,
    "duration_minutes" INTEGER,
    "location" VARCHAR(200),
    "judge" VARCHAR(200),
    "notes" TEXT,
    "outcome" TEXT,
    "previous_id" UUID,
    "metadata" JSONB,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "audiencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audiencia_processo_scheduled" ON "audiencias"("gabinete_id", "processo_id", "scheduled_at");
CREATE INDEX "idx_audiencia_gabinete_status" ON "audiencias"("gabinete_id", "status");
CREATE INDEX "idx_audiencia_gabinete_scheduled" ON "audiencias"("gabinete_id", "scheduled_at");

-- AddForeignKey
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_previous_id_fkey" FOREIGN KEY ("previous_id") REFERENCES "audiencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
