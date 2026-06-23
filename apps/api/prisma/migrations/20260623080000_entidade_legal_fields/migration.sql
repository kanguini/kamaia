-- Adiciona campos legais exigidos pela lei angolana para contratos.
-- Pessoa singular: estado civil + regime de bens + profissão + dados BI.
-- Pessoa colectiva: forma jurídica + capital social + objecto + data constituição.
ALTER TABLE "entidades"
  ADD COLUMN "estado_civil" VARCHAR(40),
  ADD COLUMN "regime_bens" VARCHAR(40),
  ADD COLUMN "profissao" VARCHAR(100),
  ADD COLUMN "bi_emitido_em" DATE,
  ADD COLUMN "bi_valido_ate" DATE,
  ADD COLUMN "bi_emissor" VARCHAR(100),
  ADD COLUMN "forma_juridica" VARCHAR(40),
  ADD COLUMN "capital_social_centavos" BIGINT,
  ADD COLUMN "capital_social_moeda" VARCHAR(3),
  ADD COLUMN "objecto_social" TEXT,
  ADD COLUMN "data_constituicao" DATE;

-- Índice para o alerta proactivo de "BI expira em N dias"
-- (scanner do alerts-scheduler vai usar este).
CREATE INDEX "entidades_bi_valido_ate_idx"
  ON "entidades"("bi_valido_ate")
  WHERE "bi_valido_ate" IS NOT NULL AND "deleted_at" IS NULL;
