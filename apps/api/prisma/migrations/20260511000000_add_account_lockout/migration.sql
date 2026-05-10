-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ;

-- CreateIndex (queries de lock check filtram por email + lockedUntil)
CREATE INDEX "idx_users_locked_until" ON "users"("locked_until") WHERE "locked_until" IS NOT NULL;
