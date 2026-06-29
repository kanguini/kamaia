-- Checklist e comentários dentro de cada tarefa. Aditivo (2 tabelas novas).

CREATE TABLE "tarefa_checklist_itens" (
  "id" UUID NOT NULL,
  "tarefa_id" UUID NOT NULL,
  "texto" VARCHAR(500) NOT NULL,
  "concluido" BOOLEAN NOT NULL DEFAULT false,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tarefa_checklist_itens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tarefa_checklist_itens_tarefa_id_idx" ON "tarefa_checklist_itens" ("tarefa_id");
ALTER TABLE "tarefa_checklist_itens"
  ADD CONSTRAINT "tarefa_checklist_itens_tarefa_id_fkey"
  FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tarefa_comentarios" (
  "id" UUID NOT NULL,
  "tarefa_id" UUID NOT NULL,
  "autor_id" UUID NOT NULL,
  "texto" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tarefa_comentarios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tarefa_comentarios_tarefa_id_idx" ON "tarefa_comentarios" ("tarefa_id");
ALTER TABLE "tarefa_comentarios"
  ADD CONSTRAINT "tarefa_comentarios_tarefa_id_fkey"
  FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tarefa_comentarios"
  ADD CONSTRAINT "tarefa_comentarios_autor_id_fkey"
  FOREIGN KEY ("autor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
