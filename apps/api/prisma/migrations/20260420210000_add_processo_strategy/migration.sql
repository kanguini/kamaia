-- Notas estratégicas privadas do processo: teses, riscos, cenários,
-- plano de ataque/defesa. Distinto de `description` (contexto público)
-- e `notes` (notas operacionais livres).

ALTER TABLE "processos" ADD COLUMN "strategy" TEXT;
