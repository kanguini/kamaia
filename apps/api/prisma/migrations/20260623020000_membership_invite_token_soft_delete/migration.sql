-- AlterTable
ALTER TABLE "memberships"
  ADD COLUMN "invite_token_hash" VARCHAR(64),
  ADD COLUMN "invite_token_prefix" VARCHAR(20),
  ADD COLUMN "invite_expires_at" TIMESTAMPTZ,
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "memberships_invite_token_hash_key" ON "memberships"("invite_token_hash");

-- CreateIndex
CREATE INDEX "memberships_invite_token_hash_idx" ON "memberships"("invite_token_hash");
