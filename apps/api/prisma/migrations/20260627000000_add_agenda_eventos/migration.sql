-- CreateEnum
CREATE TYPE "AgendaEventoTipo" AS ENUM ('GERAL', 'REUNIAO', 'PRAZO', 'AUDIENCIA', 'LEMBRETE', 'ASSINATURA');

-- CreateTable
CREATE TABLE "agenda_eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "tipo" "AgendaEventoTipo" NOT NULL DEFAULT 'GERAL',
    "inicio" TIMESTAMPTZ NOT NULL,
    "fim" TIMESTAMPTZ,
    "dia_inteiro" BOOLEAN NOT NULL DEFAULT false,
    "local" VARCHAR(200),
    "cor" VARCHAR(20),
    "contrato_id" UUID,
    "entidade_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "agenda_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_eventos_tenant_id_inicio_idx" ON "agenda_eventos"("tenant_id", "inicio");

-- CreateIndex
CREATE INDEX "agenda_eventos_tenant_id_deleted_at_idx" ON "agenda_eventos"("tenant_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
