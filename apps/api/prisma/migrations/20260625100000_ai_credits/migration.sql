-- Adiciona contadores de AI credits separados das messages do chat.
--
-- Razão: messages do chat são gratuitas até ao limite do plano
-- (uma feature core). AI credits são para operações de alto custo
-- (parsing batch, extracção massiva, drafting de contratos), que
-- consomem 10-100x mais tokens. Recarregáveis via top-up.
--
-- Migration aditiva. Tenants existentes ficam com 0 / 0 (não usam
-- credits até serem atribuídos pelo plano).

ALTER TABLE "usage_quotas"
  ADD COLUMN "ai_credits_limit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ai_credits_usado" INTEGER NOT NULL DEFAULT 0;
