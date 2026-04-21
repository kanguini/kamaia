#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Kamaia — Backup do PostgreSQL
#
# Gera um `pg_dump` comprimido, opcionalmente cifrado com AGE,
# e envia para um backend S3-compatível (Backblaze B2, AWS S3,
# DigitalOcean Spaces, MinIO). Retention-policy simples baseada
# em prefixos diários/semanais/mensais no alvo.
#
# Idempotente e safe-to-cron: falha limpa em qualquer dependência
# em falta. Nunca apaga dumps antigos — esse trabalho é da policy
# do bucket (object-lock / lifecycle rule), não do cliente.
#
# ─── Uso ───────────────────────────────────────────────────
#   ./scripts/backup-db.sh [daily|weekly|monthly]
#
# ─── Variáveis necessárias ─────────────────────────────────
#   DATABASE_URL              — string de ligação Postgres
#   BACKUP_BUCKET             — nome do bucket S3-compat
#   BACKUP_PREFIX             — prefixo opcional (default: kamaia/)
#   AWS_ACCESS_KEY_ID         — credencial do bucket
#   AWS_SECRET_ACCESS_KEY     — credencial do bucket
#   AWS_ENDPOINT_URL          — endpoint S3-compat (default: AWS)
#   AWS_REGION                — região (default: eu-central-1)
#
# ─── Variáveis opcionais ───────────────────────────────────
#   BACKUP_AGE_RECIPIENT      — chave pública AGE; se definida, cifra o dump
#   BACKUP_RETENTION_DAYS     — informativo (a policy é no bucket)
# ═══════════════════════════════════════════════════════════

set -euo pipefail

TIER="${1:-daily}"
case "$TIER" in
  daily|weekly|monthly) ;;
  *) echo "Uso: $0 [daily|weekly|monthly]"; exit 2 ;;
esac

: "${DATABASE_URL:?DATABASE_URL não definida}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET não definida}"

BACKUP_PREFIX="${BACKUP_PREFIX:-kamaia/}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

command -v pg_dump >/dev/null 2>&1 || { echo "ERRO: pg_dump em falta (instalar postgresql-client)"; exit 3; }
command -v aws >/dev/null 2>&1 || { echo "ERRO: aws CLI em falta"; exit 3; }

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

DUMP_FILE="$TMPDIR/kamaia-${TIER}-${TIMESTAMP}.dump"
UPLOAD_FILE="$DUMP_FILE"

echo "→ pg_dump (custom format, compressed) ..."
# -Fc: custom format, permite pg_restore selectivo
# -Z9: compressão máxima
# --no-owner / --no-privileges: portátil entre ambientes
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE" \
  "$DATABASE_URL"

DUMP_SIZE="$(stat -f%z "$DUMP_FILE" 2>/dev/null || stat -c%s "$DUMP_FILE")"
echo "  dump: ${DUMP_SIZE} bytes"

# Cifragem opcional com AGE (https://github.com/FiloSottile/age)
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null 2>&1 || { echo "ERRO: age em falta mas BACKUP_AGE_RECIPIENT definida"; exit 3; }
  ENC_FILE="${DUMP_FILE}.age"
  echo "→ cifragem AGE ..."
  age -r "$BACKUP_AGE_RECIPIENT" -o "$ENC_FILE" "$DUMP_FILE"
  rm -f "$DUMP_FILE"
  UPLOAD_FILE="$ENC_FILE"
fi

S3_KEY="${BACKUP_PREFIX}${TIER}/$(basename "$UPLOAD_FILE")"
S3_URI="s3://${BACKUP_BUCKET}/${S3_KEY}"

echo "→ upload → ${S3_URI}"
AWS_ARGS=(--region "$AWS_REGION")
if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  AWS_ARGS+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi

aws "${AWS_ARGS[@]}" s3 cp "$UPLOAD_FILE" "$S3_URI" \
  --only-show-errors \
  --metadata "tier=${TIER},timestamp=${TIMESTAMP}"

echo "✓ backup concluído: ${S3_URI}"
