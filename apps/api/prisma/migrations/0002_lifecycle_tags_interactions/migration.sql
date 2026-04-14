-- AlterTable
ALTER TABLE "gabinetes" ALTER COLUMN "plan" SET DEFAULT 'PRO_BUSINESS';

-- AlterTable
ALTER TABLE "processos" ADD COLUMN     "lifecycle" VARCHAR(30) NOT NULL DEFAULT 'ATENDIMENTO',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "hourly_rate" INTEGER;

-- CreateTable
CREATE TABLE "cliente_interactions" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_interaction_gabinete_cliente" ON "cliente_interactions"("gabinete_id", "cliente_id");

-- CreateIndex
CREATE INDEX "idx_processo_gabinete_lifecycle" ON "processos"("gabinete_id", "lifecycle");

-- AddForeignKey
ALTER TABLE "cliente_interactions" ADD CONSTRAINT "cliente_interactions_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_interactions" ADD CONSTRAINT "cliente_interactions_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_interactions" ADD CONSTRAINT "cliente_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

