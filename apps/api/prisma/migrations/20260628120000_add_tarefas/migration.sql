-- Gestor de tarefas: trabalho humano atribuível a membros, com estado e prazo.
-- Migração escrita à mão (apenas o delta de Tarefa) para não arrastar o
-- ruído de drift do `migrate diff` (DROP de FKs/defaults de search_vector).

-- CreateEnum
CREATE TYPE "TarefaEstado" AS ENUM ('A_FAZER', 'EM_CURSO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TarefaPrioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "tarefas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "estado" "TarefaEstado" NOT NULL DEFAULT 'A_FAZER',
    "prioridade" "TarefaPrioridade" NOT NULL DEFAULT 'MEDIA',
    "data_vencimento" TIMESTAMPTZ,
    "responsavel_id" UUID,
    "contrato_id" UUID,
    "entidade_id" UUID,
    "concluida_em" TIMESTAMPTZ,
    "concluida_por" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarefas_tenant_id_responsavel_id_estado_idx" ON "tarefas"("tenant_id", "responsavel_id", "estado");
CREATE INDEX "tarefas_tenant_id_estado_data_vencimento_idx" ON "tarefas"("tenant_id", "estado", "data_vencimento");
CREATE INDEX "tarefas_tenant_id_contrato_id_idx" ON "tarefas"("tenant_id", "contrato_id");
CREATE INDEX "tarefas_tenant_id_deleted_at_idx" ON "tarefas"("tenant_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
