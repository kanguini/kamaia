-- PERFORMANCE: índices da lista/dashboard + scan da renovação.
-- Declarados em schema.prisma (Prisma-managed).
CREATE INDEX "contratos_tenant_id_created_at_id_idx" ON "contratos"("tenant_id", "created_at", "id");
CREATE INDEX "contratos_tenant_id_updated_at_idx" ON "contratos"("tenant_id", "updated_at");
CREATE INDEX "contratos_estado_data_termo_idx" ON "contratos"("estado", "data_termo");

-- PERFORMANCE (P0): popular `search_vector` como coluna GERADA STORED.
-- Estava sempre NULL (sem trigger nem generated), por isso a pesquisa
-- FTS por título/descrição devolvia ZERO e o índice GIN era peso morto.
-- `to_tsvector('portuguese', ...)` (forma de 2 args) é IMMUTABLE, logo
-- válida numa generated column. Recria-se a coluna (não dá ALTER → GENERATED)
-- e o respectivo índice GIN.

-- contratos: título + descrição + número
DROP INDEX IF EXISTS "contratos_search_vector_idx";
ALTER TABLE "contratos" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "contratos" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'portuguese',
      coalesce("titulo", '') || ' ' ||
      coalesce("descricao", '') || ' ' ||
      coalesce("numero_interno", '')
    )
  ) STORED;
CREATE INDEX "contratos_search_vector_idx" ON "contratos" USING GIN ("search_vector");

-- entidades: nome + nome comercial + NIF + BI
DROP INDEX IF EXISTS "entidades_search_vector_idx";
ALTER TABLE "entidades" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "entidades" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'portuguese',
      coalesce("nome", '') || ' ' ||
      coalesce("nome_comercial", '') || ' ' ||
      coalesce("nif", '') || ' ' ||
      coalesce("numero_bi", '')
    )
  ) STORED;
CREATE INDEX "entidades_search_vector_idx" ON "entidades" USING GIN ("search_vector");

-- clausulas: título + conteúdo
DROP INDEX IF EXISTS "clausulas_search_vector_idx";
ALTER TABLE "clausulas" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "clausulas" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'portuguese',
      coalesce("titulo", '') || ' ' || coalesce("conteudo", '')
    )
  ) STORED;
CREATE INDEX "clausulas_search_vector_idx" ON "clausulas" USING GIN ("search_vector");
