-- Adiciona campos de password reset ao User.
ALTER TABLE "users"
  ADD COLUMN "reset_token_hash" VARCHAR(64),
  ADD COLUMN "reset_token_prefix" VARCHAR(20),
  ADD COLUMN "reset_expires_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX "users_reset_token_hash_key" ON "users"("reset_token_hash");
CREATE INDEX "users_reset_token_hash_idx" ON "users"("reset_token_hash");
