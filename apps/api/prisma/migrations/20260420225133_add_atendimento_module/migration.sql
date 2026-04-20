-- CreateTable
CREATE TABLE "atendimentos" (
    "id" UUID NOT NULL,
    "gabinete_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "name" VARCHAR(300) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "nif" VARCHAR(20),
    "email" VARCHAR(200),
    "phone" VARCHAR(30),
    "subject" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "source" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'NOVO',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
    "notes" TEXT,
    "converted_cliente_id" UUID,
    "converted_processo_id" UUID,
    "converted_at" TIMESTAMPTZ,
    "lost_reason" VARCHAR(300),
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_atendimento_gabinete" ON "atendimentos"("gabinete_id");

-- CreateIndex
CREATE INDEX "idx_atendimento_gabinete_status" ON "atendimentos"("gabinete_id", "status");

-- CreateIndex
CREATE INDEX "idx_atendimento_gabinete_assigned" ON "atendimentos"("gabinete_id", "assigned_to_id");

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "gabinetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_converted_cliente_id_fkey" FOREIGN KEY ("converted_cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_converted_processo_id_fkey" FOREIGN KEY ("converted_processo_id") REFERENCES "processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
