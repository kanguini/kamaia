-- Migrar código de moeda AKZ (legado) para AOA (ISO 4217 correcto para Kwanza angolano).
-- Alinha o schema ao briefing do produto (PT-AO).

-- Actualizar defaults das colunas
ALTER TABLE "projects" ALTER COLUMN "budget_currency" SET DEFAULT 'AOA';
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'AOA';

-- Reclassificar registos existentes que ainda tenham AKZ
UPDATE "projects" SET "budget_currency" = 'AOA' WHERE "budget_currency" = 'AKZ';
UPDATE "invoices" SET "currency" = 'AOA' WHERE "currency" = 'AKZ';
