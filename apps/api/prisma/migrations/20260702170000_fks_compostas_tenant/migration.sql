-- ═══════════════════════════════════════════════════════════════════
-- Auditoria Jul/2026 — C8: isolamento multi-tenant imposto pela BD
--
-- Migração escrita à mão (padrão do projecto). Até aqui, TODAS as FKs
-- entre agregados eram simples (id) — bastava um bug de service para
-- um Contrato do tenant A referenciar uma Entidade/Carteira do tenant
-- B, e a BD aceitava sem protestar. Este passo:
--   1. UNIQUE (tenant_id, id) em entidades/carteiras/contratos —
--      alvo obrigatório das FKs compostas.
--   2. contrato_partes ganha tenant_id (backfill do contrato) + FK
--      composta → entidades. Uma parte NUNCA pode apontar para
--      entidade de outro tenant. (Modelada também no Prisma.)
--   3. FKs compostas nas relações nullable contrato↔carteira e
--      tarefas/documents/agenda_eventos↔contratos, com a sintaxe
--      PG15+ `ON DELETE SET NULL (coluna)` — anular SÓ a coluna de
--      referência, nunca o tenant_id. Estas 4 vivem só na BD (o
--      Prisma não modela relações compostas com coluna nullable +
--      tenantId obrigatório) — drift DELIBERADO e documentado, como
--      o dos search_vector.
--
-- FKs novas entram NOT VALID (não bloqueiam em dados históricos) e
-- tenta-se VALIDATE logo a seguir; se houver lixo cross-tenant
-- pré-existente, a constraint fica activa para escritas novas e o
-- VALIDATE é repetível depois de limpar os dados.
-- ═══════════════════════════════════════════════════════════════════

-- 1 ── Alvos únicos compostos ────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "entidades_tenant_id_id_key" ON "entidades"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "carteiras_tenant_id_id_key" ON "carteiras"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "contratos_tenant_id_id_key" ON "contratos"("tenant_id", "id");

-- 2 ── contrato_partes: tenant_id + FK composta → entidades ──────────
ALTER TABLE "contrato_partes" ADD COLUMN "tenant_id" UUID;
UPDATE "contrato_partes" p
  SET "tenant_id" = c."tenant_id"
  FROM "contratos" c
  WHERE p."contrato_id" = c."id" AND p."tenant_id" IS NULL;
ALTER TABLE "contrato_partes" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "contrato_partes_tenant_id_idx" ON "contrato_partes"("tenant_id");

ALTER TABLE "contrato_partes" DROP CONSTRAINT "contrato_partes_entidade_id_fkey";
ALTER TABLE "contrato_partes" ADD CONSTRAINT "contrato_partes_tenant_id_entidade_id_fkey"
  FOREIGN KEY ("tenant_id", "entidade_id") REFERENCES "entidades"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- 3 ── FKs compostas nas relações nullable (só-BD, drift documentado) ─
ALTER TABLE "contratos" DROP CONSTRAINT "contratos_carteira_id_fkey";
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_carteira_id_fkey"
  FOREIGN KEY ("tenant_id", "carteira_id") REFERENCES "carteiras"("tenant_id", "id")
  ON DELETE SET NULL ("carteira_id") ON UPDATE CASCADE NOT VALID;

ALTER TABLE "tarefas" DROP CONSTRAINT "tarefas_contrato_id_fkey";
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_contrato_id_fkey"
  FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "contratos"("tenant_id", "id")
  ON DELETE SET NULL ("contrato_id") ON UPDATE CASCADE NOT VALID;

ALTER TABLE "documents" DROP CONSTRAINT "documents_contrato_id_fkey";
ALTER TABLE "documents" ADD CONSTRAINT "documents_contrato_id_fkey"
  FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "contratos"("tenant_id", "id")
  ON DELETE SET NULL ("contrato_id") ON UPDATE CASCADE NOT VALID;

ALTER TABLE "agenda_eventos" DROP CONSTRAINT "agenda_eventos_contrato_id_fkey";
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_contrato_id_fkey"
  FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "contratos"("tenant_id", "id")
  ON DELETE SET NULL ("contrato_id") ON UPDATE CASCADE NOT VALID;

-- 4 ── Validar as FKs (tolerante a lixo histórico) ───────────────────
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conrelid::regclass::text AS tabela, conname
    FROM pg_constraint
    WHERE conname IN (
      'contrato_partes_tenant_id_entidade_id_fkey',
      'contratos_carteira_id_fkey',
      'tarefas_contrato_id_fkey',
      'documents_contrato_id_fkey',
      'agenda_eventos_contrato_id_fkey'
    ) AND NOT convalidated
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tabela, c.conname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FK % em % tem violações históricas — fica NOT VALID (activa p/ escritas novas). Limpar dados e VALIDATE.',
        c.conname, c.tabela;
    END;
  END LOOP;
END $$;
