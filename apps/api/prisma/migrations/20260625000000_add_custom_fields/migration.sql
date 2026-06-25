-- Schema dinâmico de campos custom por TipoContrato.
-- Permite que cada tipo (NDA, Commercial Lease, etc.) defina os seus
-- campos extra sem inflar o schema do Contrato com dezenas de colunas
-- nullable que para a maioria dos tipos são "—".
--
-- Migration é puramente aditiva: nenhuma coluna existente é alterada,
-- nenhum dado é tocado. Contratos pré-existentes continuam sem custom
-- field values (todos os blocos no UI renderizam como "vazio").

-- ─── Enum tipo de campo ──────────────────────────────────────────
CREATE TYPE "CustomFieldType" AS ENUM (
  'STRING',
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MONEY',
  'ADDRESS'
);

-- ─── Definições de custom fields por TipoContrato ────────────────
CREATE TABLE "custom_field_definitions" (
  "id"               UUID            NOT NULL DEFAULT gen_random_uuid(),
  "tipo_contrato_id" UUID            NOT NULL,
  "key"              VARCHAR(60)     NOT NULL,
  "label"            VARCHAR(120)    NOT NULL,
  "hint"             VARCHAR(400),
  "type"             "CustomFieldType" NOT NULL,
  "options"          JSONB,
  "required"         BOOLEAN         NOT NULL DEFAULT FALSE,
  "ordem"            INTEGER         NOT NULL DEFAULT 0,
  "is_active"        BOOLEAN         NOT NULL DEFAULT TRUE,
  "created_at"       TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ     NOT NULL,
  "deleted_at"       TIMESTAMPTZ,

  CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_field_definitions_tipo_fk"
    FOREIGN KEY ("tipo_contrato_id")
    REFERENCES "tipos_contrato"("id")
    ON DELETE CASCADE
);

-- Key única por TipoContrato — proíbe duplicados ("areaM2" duas
-- vezes no mesmo tipo) mas permite re-uso entre tipos diferentes.
CREATE UNIQUE INDEX "custom_field_definitions_tipo_key_unique"
  ON "custom_field_definitions"("tipo_contrato_id", "key");

-- Para listar fields de um tipo ordenados sem sort.
CREATE INDEX "custom_field_definitions_tipo_ordem_idx"
  ON "custom_field_definitions"("tipo_contrato_id", "ordem");

-- ─── Valores dos custom fields por contrato ──────────────────────
CREATE TABLE "contrato_custom_field_values" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "contrato_id"  UUID         NOT NULL,
  "field_id"     UUID         NOT NULL,
  "value"        JSONB        NOT NULL,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ  NOT NULL,

  CONSTRAINT "contrato_custom_field_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contrato_custom_field_values_contrato_fk"
    FOREIGN KEY ("contrato_id")
    REFERENCES "contratos"("id")
    ON DELETE CASCADE,
  CONSTRAINT "contrato_custom_field_values_field_fk"
    FOREIGN KEY ("field_id")
    REFERENCES "custom_field_definitions"("id")
);

-- Um valor por (contrato, field) — proíbe duplicação em vez de
-- aceitar lista de valores. A Sprint 2.x pode estender com
-- repeating fields se a procura aparecer.
CREATE UNIQUE INDEX "contrato_custom_field_values_unique"
  ON "contrato_custom_field_values"("contrato_id", "field_id");

-- Útil para "todos os contratos com um valor para o campo X".
CREATE INDEX "contrato_custom_field_values_field_idx"
  ON "contrato_custom_field_values"("field_id");
