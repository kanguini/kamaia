#!/bin/sh
set -e

echo "================================================"
echo "Kamaia API — Container startup"
echo "================================================"
echo "NODE_ENV: ${NODE_ENV:-unset}"
echo "PORT: ${PORT:-unset}"
echo "DATABASE_URL: ${DATABASE_URL:+set}"
echo "================================================"

# Apply pending migrations (safe, versioned, never drops data).
# prisma migrate deploy only runs forward — it NEVER deletes columns or tables.
echo "[entrypoint] Running prisma migrate deploy..."
if timeout 120 npx prisma migrate deploy; then
  echo "[entrypoint] Migrations applied successfully"
else
  echo "[entrypoint] WARNING: Migration failed or timed out"
  echo "[entrypoint] Attempting prisma db push (safe mode, no data loss)..."
  # Fallback: db push WITHOUT --accept-data-loss
  # This will FAIL if destructive changes are needed — which is correct.
  timeout 60 npx prisma db push --skip-generate || echo "[entrypoint] db push failed — manual intervention needed"
fi

echo "[entrypoint] Starting NestJS..."
exec node dist/main
