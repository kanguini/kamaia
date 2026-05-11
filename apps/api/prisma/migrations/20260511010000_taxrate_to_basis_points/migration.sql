-- ============================================================
-- taxRate: Float → Int (basis points)
-- ============================================================
-- Converte invoices.tax_rate de Float (14.0 = 14%) para Int em
-- basis points (1400 = 14.00%). Evita drift de arredondamento em
-- cálculos monetários — qualquer Decimal/Float era uma bomba relógio.
--
-- Conversão idempotente:
--   ROUND(tax_rate * 100) → basis points
--   Default novo: 1400 (= 14% IVA Angola geral)
--
-- Após esta migration:
--   tax_amount = (subtotal * tax_rate) / 10000  (Int division)
-- ============================================================

-- 1) Drop default antigo (Float 14.0) antes de ALTER COLUMN
ALTER TABLE "invoices" ALTER COLUMN "tax_rate" DROP DEFAULT;

-- 2) Converter Float → Int basis points (ROUND para garantir whole)
ALTER TABLE "invoices"
  ALTER COLUMN "tax_rate" TYPE INTEGER
  USING ROUND("tax_rate" * 100)::INTEGER;

-- 3) Set default novo (basis points)
ALTER TABLE "invoices" ALTER COLUMN "tax_rate" SET DEFAULT 1400;
