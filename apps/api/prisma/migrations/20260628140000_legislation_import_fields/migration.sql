-- Estende legislation_documents para suportar o corpus importado (ex. lex.ao).
-- Alteração puramente aditiva: codigo passa a opcional, url ganha unicidade,
-- e adicionam-se orgao/ano/fonte para filtragem e navegação.

ALTER TABLE "legislation_documents" ALTER COLUMN "codigo" DROP NOT NULL;
ALTER TABLE "legislation_documents" ADD COLUMN "orgao" VARCHAR(200);
ALTER TABLE "legislation_documents" ADD COLUMN "ano" INTEGER;
ALTER TABLE "legislation_documents" ADD COLUMN "fonte" VARCHAR(20) NOT NULL DEFAULT 'CURADO';

-- url como chave natural dos diplomas importados (NULLs múltiplos são
-- permitidos pelo Postgres num índice único, por isso os curados sem url
-- continuam válidos).
CREATE UNIQUE INDEX "legislation_documents_url_key" ON "legislation_documents" ("url");
CREATE INDEX "legislation_documents_fonte_orgao_idx" ON "legislation_documents" ("fonte", "orgao");
