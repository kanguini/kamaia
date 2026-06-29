-- Colunas personalizadas do quadro de tarefas (coexistem com o `estado`).
-- Aditivo: nova tabela + coluna_id opcional na tarefa.

CREATE TABLE "tarefa_colunas" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "nome" VARCHAR(60) NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "cor" VARCHAR(20),
  "estado" "TarefaEstado",
  "sistema" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tarefa_colunas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tarefa_colunas_tenant_id_ordem_idx" ON "tarefa_colunas" ("tenant_id", "ordem");
ALTER TABLE "tarefa_colunas"
  ADD CONSTRAINT "tarefa_colunas_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tarefas" ADD COLUMN "coluna_id" UUID;
CREATE INDEX "tarefas_tenant_id_coluna_id_idx" ON "tarefas" ("tenant_id", "coluna_id");
ALTER TABLE "tarefas"
  ADD CONSTRAINT "tarefas_coluna_id_fkey"
  FOREIGN KEY ("coluna_id") REFERENCES "tarefa_colunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
