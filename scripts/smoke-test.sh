#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Kamaia CLM — Smoke test E2E
#
# Valida o happy path completo contra uma API em execução:
#   1. Login admin
#   2. Lê tenants do user
#   3. Switcha para o tenant demo
#   4. Lê catálogo de TipoContrato
#   5. Cria 2 entidades (residente + não-residente)
#   6. Cria contrato (USD 100k, serviços, não-residente)
#   7. Adiciona partes
#   8. Dispara ComplianceEngine
#   9. Verifica os 3 actos esperados (IS + BNA + AGT)
#  10. Testa transição válida (INTAKE → DRAFTING)
#  11. Testa transição inválida (DRAFTING → ACTIVO) → 400
#  12. Lê dashboard
#  13. Lê regras do engine
#
# Pré-requisitos:
#   - API a correr em http://localhost:3001/api
#   - Seed corrido (cria admin@kamaia.dev + tenant kamaia-demo)
#
# Uso:
#   ./scripts/smoke-test.sh
#   API_URL=https://kamaia-api.up.railway.app/api ./scripts/smoke-test.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"
EMAIL="${EMAIL:-admin@kamaia.dev}"
PASSWORD="${PASSWORD:-Kamaia2026!}"

# Cores
G='\033[0;32m'
R='\033[0;31m'
Y='\033[1;33m'
N='\033[0m'

pass() { printf "${G}✓${N} %s\n" "$1"; }
fail() { printf "${R}✗${N} %s\n" "$1"; exit 1; }
info() { printf "${Y}▶${N} %s\n" "$1"; }

# Helper: extrai JSON path
jget() {
  python3 -c "import sys, json; d = json.load(sys.stdin); print($1)" 2>/dev/null
}

# Helper: HTTP com JSON
req() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local extra_headers="${4:-}"

  local curl_args=(-s -X "$method" "$API_URL$path" -H "Content-Type: application/json")
  if [[ -n "${JWT:-}" ]]; then
    curl_args+=(-H "Authorization: Bearer $JWT")
  fi
  if [[ -n "${TENANT_ID:-}" && "$path" != /auth/* && "$path" != /tenants ]]; then
    curl_args+=(-H "X-Tenant-Id: $TENANT_ID")
  fi
  if [[ -n "$body" ]]; then
    curl_args+=(-d "$body")
  fi
  curl "${curl_args[@]}"
}

printf "\n${Y}═══ Kamaia CLM smoke test ═══${N}\n"
printf "  API:   %s\n" "$API_URL"
printf "  User:  %s\n\n" "$EMAIL"

# ─── 1. Health ───
info "1. Health check"
HEALTH=$(curl -s "$API_URL/health")
STATUS=$(echo "$HEALTH" | jget 'd["status"]')
DB=$(echo "$HEALTH" | jget 'd["database"]')
[[ "$STATUS" == "ok" && "$DB" == "ok" ]] || fail "Health failed: $HEALTH"
pass "Health: status=$STATUS db=$DB"

# ─── 2. Login ───
info "2. Login"
LOGIN_RES=$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
JWT=$(echo "$LOGIN_RES" | jget 'd["accessToken"]') || fail "Login failed: $LOGIN_RES"
USER_EMAIL=$(echo "$LOGIN_RES" | jget 'd["user"]["email"]')
TENANT_COUNT=$(echo "$LOGIN_RES" | jget 'len(d["tenants"])')
pass "Login OK ($USER_EMAIL, $TENANT_COUNT tenants)"

# ─── 3. Tenant ───
info "3. Tenant context"
TENANT_ID=$(echo "$LOGIN_RES" | jget 'd["tenants"][0]["id"]')
TENANT_NOME=$(echo "$LOGIN_RES" | jget 'd["tenants"][0]["nome"]')
TENANT_PLAN=$(echo "$LOGIN_RES" | jget 'd["tenants"][0]["plan"]')
ROLE=$(echo "$LOGIN_RES" | jget 'd["tenants"][0]["role"]')
pass "Active tenant: $TENANT_NOME ($TENANT_PLAN) as $ROLE"

CURRENT=$(req GET /tenants/current)
NIF=$(echo "$CURRENT" | jget 'd["nif"]')
[[ "$NIF" == "5000000000" ]] || fail "Wrong tenant: $CURRENT"
pass "GET /tenants/current ok"

# ─── 4. Catálogo ───
info "4. Catálogo TipoContrato"
TIPOS=$(req GET /tipos-contrato)
TIPOS_N=$(echo "$TIPOS" | jget 'len(d)')
[[ "$TIPOS_N" -ge 25 ]] || fail "Esperado ≥25 tipos, obtido $TIPOS_N"
pass "$TIPOS_N tipos no catálogo"

TIPO_ID=$(echo "$TIPOS" | jget "[t['id'] for t in d if t['codigo']=='PRESTACAO_SERVICOS'][0]")

# ─── 5. Entidades ───
info "5. Criar entidades"
SELF_RES=$(req POST /entidades '{"tipo":"PESSOA_COLECTIVA","nome":"Smoke Test Lda","nif":"5100100100","nacionalidadeCambial":"RESIDENTE","sectorActividade":"TECNOLOGIA"}')
SELF_ID=$(echo "$SELF_RES" | jget 'd["id"]') || fail "Falhou criar entidade self: $SELF_RES"

CP_RES=$(req POST /entidades '{"tipo":"PESSOA_COLECTIVA","nome":"Smoke Counterparty BV","nif":"NL999999","nacionalidadeCambial":"NAO_RESIDENTE","paisResidencia":"NL","sectorActividade":"TECNOLOGIA"}')
CP_ID=$(echo "$CP_RES" | jget 'd["id"]') || fail "Falhou criar contraparte: $CP_RES"
pass "Entidades criadas (residente + não-residente)"

# ─── 6. Contrato ───
info "6. Criar contrato (USD 100k, serviços, não-residente)"
CONT_BODY=$(cat <<JSON
{
  "titulo":"Smoke test — Prestação de serviços TI",
  "tipoId":"$TIPO_ID",
  "valor":"10000000000",
  "moeda":"USD",
  "valorEmAKZ":"8500000000000",
  "leiAplicavel":"Lei angolana",
  "dataAssinatura":"2026-06-22",
  "dataInicioVigencia":"2026-07-01",
  "dataTermo":"2027-06-30",
  "renovacaoAutomatica":true,
  "janelaDenunciaDias":60
}
JSON
)
CONT_RES=$(req POST /contratos "$CONT_BODY")
CONT_ID=$(echo "$CONT_RES" | jget 'd["id"]') || fail "Falhou criar contrato: $CONT_RES"
CONT_NUM=$(echo "$CONT_RES" | jget 'd["numeroInterno"]')
CONT_ESTADO=$(echo "$CONT_RES" | jget 'd["estado"]')
[[ "$CONT_ESTADO" == "INTAKE" ]] || fail "Estado errado: $CONT_ESTADO"
pass "Contrato $CONT_NUM em INTAKE"

# ─── 7. Partes ───
info "7. Adicionar partes"
req POST "/contratos/$CONT_ID/partes" "{\"entidadeId\":\"$SELF_ID\",\"papel\":\"PARTE_PRINCIPAL\"}" > /dev/null
req POST "/contratos/$CONT_ID/partes" "{\"entidadeId\":\"$CP_ID\",\"papel\":\"CONTRAPARTE\"}" > /dev/null
pass "2 partes adicionadas"

# ─── 8. Compliance ───
info "8. Disparar ComplianceEngine"
EVAL_RES=$(req POST "/compliance/contratos/$CONT_ID/avaliar")
N_ACTOS=$(echo "$EVAL_RES" | jget 'd["adicionados"]')
[[ "$N_ACTOS" -ge 3 ]] || fail "Esperado ≥3 actos, obtido $N_ACTOS: $EVAL_RES"
pass "$N_ACTOS actos detectados"

# ─── 9. Verificar 3 actos esperados ───
info "9. Verificar IS + BNA + AGT"
DETAIL=$(req GET "/contratos/$CONT_ID")
TYPES=$(echo "$DETAIL" | jget "sorted({a['tipo'] for a in d['actosRegulatorios']})")
echo "$TYPES" | grep -q "IMPOSTO_SELO" || fail "Falta IMPOSTO_SELO"
echo "$TYPES" | grep -q "BNA_AUTORIZACAO" || fail "Falta BNA_AUTORIZACAO"
echo "$TYPES" | grep -q "AGT_RETENCAO_IRT" || fail "Falta AGT_RETENCAO_IRT"
pass "Os 3 actos esperados estão presentes"

# Verifica que IS é 1% (10000000000 / 100 = 100000000)
IS_VALOR=$(echo "$DETAIL" | jget "next((a['valorLiquidar'] for a in d['actosRegulatorios'] if a['tipo']=='IMPOSTO_SELO'), None)")
[[ "$IS_VALOR" == "100000000" ]] || fail "IS valor errado: $IS_VALOR (esperado 100000000)"
pass "IS valor correcto: AKZ 1.000.000 (1% sobre USD 100M)"

# ─── 10. State machine: transição válida ───
info "10. Transição INTAKE → DRAFTING"
TRANS_OK=$(req POST "/contratos/$CONT_ID/transicao" '{"para":"DRAFTING","motivo":"smoke test"}')
NEW_ESTADO=$(echo "$TRANS_OK" | jget 'd["estado"]')
[[ "$NEW_ESTADO" == "DRAFTING" ]] || fail "Estado errado após transição: $NEW_ESTADO"
pass "Transição válida ok"

# ─── 11. State machine: transição inválida ───
info "11. Transição DRAFTING → ACTIVO (skip ilegal)"
TRANS_KO=$(req POST "/contratos/$CONT_ID/transicao" '{"para":"ACTIVO"}')
STATUS_CODE=$(echo "$TRANS_KO" | jget "d.get('statusCode', 200)")
[[ "$STATUS_CODE" == "400" ]] || fail "Esperado 400, obtido $STATUS_CODE: $TRANS_KO"
pass "Transição ilegal rejeitada com 400"

# ─── 12. Dashboard ───
info "12. Dashboard"
DASH=$(req GET /contratos/dashboard)
TOTAL=$(echo "$DASH" | jget 'd["total"]')
ACTOS_PEND=$(echo "$DASH" | jget 'd["actosPendentes"]')
[[ "$TOTAL" -ge 1 ]] || fail "Dashboard vazio: $DASH"
pass "Dashboard: $TOTAL contratos · $ACTOS_PEND actos pendentes"

# ─── 13. Regras do engine ───
info "13. Engine introspection"
RULES=$(req GET /compliance/regras)
RULES_N=$(echo "$RULES" | jget 'len(d)')
[[ "$RULES_N" -ge 15 ]] || fail "Esperado ≥15 regras, obtido $RULES_N"
pass "$RULES_N regras de compliance vigentes"

printf "\n${G}═══ SMOKE TEST PASSED ═══${N}\n"
printf "  Contrato criado: %s\n" "$CONT_ID"
printf "  Estado final:    DRAFTING\n"
printf "  Actos sugeridos: 3 (IS + BNA + AGT)\n\n"
