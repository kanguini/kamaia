#!/bin/sh
set -e

echo "================================================"
echo "Kamaia API — Container startup"
echo "================================================"
echo "NODE_ENV: ${NODE_ENV:-unset}"
echo "PORT: ${PORT:-unset}"
echo "DATABASE_URL: ${DATABASE_URL:+set}"
echo "================================================"

# Apply pending migrations. `migrate deploy` is forward-only, never destructive.
# If it fails we ABORT — never fall back to `db push`, which can apply schema
# drift silently and leave production in an inconsistent state.
# Railway's restartPolicy (5 attempts) gives us natural retries for transient
# DB connectivity issues without masking real schema problems.
echo "[entrypoint] Running prisma migrate deploy..."
if ! timeout 120 npx prisma migrate deploy; then
  echo "[entrypoint] FATAL: prisma migrate deploy failed."
  echo "[entrypoint] Refusing to start API with un-migrated schema."
  echo "[entrypoint] Inspect logs above, fix the migration, and redeploy."
  exit 1
fi
echo "[entrypoint] Migrations applied successfully"

echo "[entrypoint] Starting NestJS..."
exec node dist/main
