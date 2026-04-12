#!/bin/sh
set -e

echo "================================================"
echo "Kamaia API — Container startup"
echo "================================================"
echo "NODE_ENV: ${NODE_ENV:-unset}"
echo "PORT: ${PORT:-unset}"
echo "DATABASE_URL: ${DATABASE_URL:+set}"
echo "================================================"

# Apply Prisma schema (idempotent) with a timeout so we don't hang forever.
# If it fails, we still try to start the app — the DB may already be in sync.
echo "[entrypoint] Running prisma db push..."
if timeout 60 npx prisma db push --skip-generate --accept-data-loss; then
  echo "[entrypoint] prisma db push OK"
else
  echo "[entrypoint] prisma db push FAILED or TIMED OUT — continuing anyway"
fi

echo "[entrypoint] Starting NestJS..."
exec node dist/main
