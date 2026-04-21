#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Kamaia — Restore do PostgreSQL
#
# Contraparte de backup-db.sh. Descarrega um dump do bucket,
# decifra se aplicável, e restaura para a BD indicada. NUNCA
# escreve na BD de produção por defeito — exige `TARGET_DATABASE_URL`
# explícito e confirmação interactiva.
#
# ─── Uso ───────────────────────────────────────────────────
#   ./scripts/restore-db.sh <s3-key>
#
# ─── Variáveis necessárias ─────────────────────────────────
#   TARGET_DATABASE_URL       — BD destino (DEVE ser diferente de prod)
#   BACKUP_BUCKET             — bucket S3-compat
#   AWS_ACCESS_KEY_ID         — credencial
#   AWS_SECRET_ACCESS_KEY     — credencial
#   AWS_ENDPOINT_URL          — endpoint S3-compat (opcional)
#   AWS_REGION                — região
#   BACKUP_AGE_IDENTITY       — chave privada AGE se dump cifrado
# ═══════════════════════════════════════════════════════════

set -euo pipefail

S3_KEY="${1:-}"
if [ -z "$S3_KEY" ]; then
  echo "Uso: $0 <s3-key>"
  echo "Ex:  $0 kamaia/daily/kamaia-daily-20260421T030000Z.dump.age"
  exit 2
fi

: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL não definida — segurança: nunca restaurar sobre prod}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET não definida}"

# Safety check: abortar se TARGET = string "prod" no URL
case "$TARGET_DATABASE_URL" in
  *prod*|*production*)
    echo "RECUSADO: TARGET_DATABASE_URL contém 'prod'. Restaurar para BD de teste primeiro."
    exit 4
    ;;
esac

AWS_REGION="${AWS_REGION:-eu-central-1}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

DOWNLOAD_FILE="$TMPDIR/$(basename "$S3_KEY")"
DUMP_FILE="$DOWNLOAD_FILE"

echo "→ download s3://${BACKUP_BUCKET}/${S3_KEY}"
AWS_ARGS=(--region "$AWS_REGION")
if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  AWS_ARGS+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi
aws "${AWS_ARGS[@]}" s3 cp "s3://${BACKUP_BUCKET}/${S3_KEY}" "$DOWNLOAD_FILE" --only-show-errors

# Decifrar se .age
if [[ "$DOWNLOAD_FILE" == *.age ]]; then
  : "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY em falta para decifrar .age}"
  command -v age >/dev/null 2>&1 || { echo "ERRO: age em falta"; exit 3; }
  DUMP_FILE="${DOWNLOAD_FILE%.age}"
  echo "→ decifragem AGE ..."
  age -d -i <(echo "$BACKUP_AGE_IDENTITY") -o "$DUMP_FILE" "$DOWNLOAD_FILE"
fi

echo ""
echo "⚠  Vai ser restaurado para: $TARGET_DATABASE_URL"
echo "   Isto apaga o conteúdo actual. Continuar? (escreve 'yes')"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelado."
  exit 0
fi

echo "→ pg_restore ..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$TARGET_DATABASE_URL" \
  "$DUMP_FILE"

echo "✓ restore concluído"
